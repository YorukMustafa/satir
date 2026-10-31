package com.satir;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:verification;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
      "APP_PUBLIC_URL=https://satir.example",
      "ADMIN_EMAIL=admin@verification.test",
      "ADMIN_PASSWORD=safe-password-123"
    })
@AutoConfigureMockMvc
class VerificationTest {
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired JdbcTemplate db;
  @Autowired RequestLimits limits;
  @Autowired EmailVerification verification;
  @MockitoBean VerificationMailer mailer;

  @BeforeEach
  void setup() {
    when(mailer.configured()).thenReturn(true);
    ((Map<?, ?>) org.springframework.test.util.ReflectionTestUtils.getField(limits, "windows"))
        .clear();
  }

  String email() {
    return UUID.randomUUID() + "@example.test";
  }

  String register(String email) throws Exception {
    mvc.perform(
            post("/api/register")
                .with(csrf())
                .contentType("application/json")
                .content(
                    json.writeValueAsString(
                        Map.of("email", email, "name", "Okur", "password", "safe-password-123"))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.verificationRequired").value(true))
        .andExpect(jsonPath("$.token").doesNotExist());
    var link = ArgumentCaptor.forClass(String.class);
    verify(mailer).sendVerification(eq(email), link.capture());
    assertTrue(link.getValue().startsWith("https://satir.example/#verify?token="));
    return link.getValue().split("token=")[1];
  }

  org.springframework.test.web.servlet.ResultActions confirm(String token) throws Exception {
    return mvc.perform(
        post("/api/email/verify")
            .with(csrf())
            .contentType("application/json")
            .content(json.writeValueAsString(Map.of("token", token))));
  }

  @Test
  void unverifiedCannotLogInAndTokenIsHashedSingleUse() throws Exception {
    String email = email(), token = register(email);
    assertEquals(64, token.length());
    String hash =
        db.queryForObject(
            "select token_hash from email_verifications where member_id=(select id from members"
                + " where email=?)",
            String.class,
            email);
    assertNotEquals(token, hash);
    mvc.perform(
            post("/api/login")
                .with(csrf())
                .param("username", email)
                .param("password", "safe-password-123"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("EMAIL_NOT_VERIFIED"));
    confirm(token).andExpect(status().isOk());
    confirm(token).andExpect(status().isBadRequest());
    mvc.perform(
            post("/api/login")
                .with(csrf())
                .param("username", email)
                .param("password", "safe-password-123"))
        .andExpect(status().isNoContent());
    assertEquals(
        0,
        db.queryForObject(
            "select count(*) from email_verifications where token_hash=?", Integer.class, hash));
  }

  @Test
  void expiredTokenCannotVerifyAnAccount() throws Exception {
    String email = email(), token = register(email);
    db.update(
        "update email_verifications set expires_at=0 where token_hash=?",
        EmailVerification.hash(token));
    confirm(token).andExpect(status().isBadRequest());
    assertFalse(
        db.queryForObject(
            "select email_verified from members where email=?", Boolean.class, email));
  }

  @Test
  void resendCooldownAndNewLinkInvalidatesOldLink() throws Exception {
    String email = email(), oldToken = register(email);
    mvc.perform(
            post("/api/email/resend")
                .with(csrf())
                .contentType("application/json")
                .content(json.writeValueAsString(Map.of("email", email))))
        .andExpect(status().isTooManyRequests());
    db.update(
        "update email_verifications set sent_at=sent_at-61000 where token_hash=?",
        EmailVerification.hash(oldToken));
    mvc.perform(
            post("/api/email/resend")
                .with(csrf())
                .contentType("application/json")
                .content(json.writeValueAsString(Map.of("email", email))))
        .andExpect(status().isOk());
    var link = ArgumentCaptor.forClass(String.class);
    verify(mailer, times(2)).sendVerification(eq(email), link.capture());
    String token = link.getValue().split("token=")[1];
    assertNotEquals(token, oldToken);
    confirm(oldToken).andExpect(status().isBadRequest());
    confirm(token).andExpect(status().isOk());
  }

  @Test
  void resendHasPersistentHourlyLimit() throws Exception {
    String email = email(), token = register(email);
    db.update(
        "update email_verifications set sent_at=sent_at-61000,sent_count=5 where token_hash=?",
        EmailVerification.hash(token));
    mvc.perform(
            post("/api/email/resend")
                .with(csrf())
                .contentType("application/json")
                .content(json.writeValueAsString(Map.of("email", email))))
        .andExpect(status().isTooManyRequests());
    verify(mailer, times(1)).sendVerification(eq(email), anyString());
  }

  @Test
  void unknownAndVerifiedResendHaveSameMessageAndNeverSend() throws Exception {
    String unknown = email();
    var unknownResponse =
        mvc.perform(
                post("/api/email/resend")
                    .with(csrf())
                    .contentType("application/json")
                    .content(json.writeValueAsString(Map.of("email", unknown))))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String email = email(), token = register(email);
    confirm(token).andExpect(status().isOk());
    mvc.perform(
            post("/api/email/resend")
                .with(csrf())
                .contentType("application/json")
                .content(json.writeValueAsString(Map.of("email", email))))
        .andExpect(status().isOk())
        .andExpect(content().json(unknownResponse));
    verify(mailer, never()).sendVerification(eq(unknown), anyString());
    verify(mailer, times(1)).sendVerification(eq(email), anyString());
  }

  @Test
  void mailFailureRollsBackAccountAndToken() throws Exception {
    String email = email();
    doThrow(BrevoMailer.unavailable()).when(mailer).sendVerification(eq(email), anyString());
    mvc.perform(
            post("/api/register")
                .with(csrf())
                .contentType("application/json")
                .content(
                    json.writeValueAsString(
                        Map.of("email", email, "name", "Okur", "password", "safe-password-123"))))
        .andExpect(status().isServiceUnavailable());
    assertEquals(
        0, db.queryForObject("select count(*) from members where email=?", Integer.class, email));
  }

  @Test
  void missingMailSetupDoesNotCreateUnusableAccounts() throws Exception {
    String email = email();
    when(mailer.configured()).thenReturn(false);
    mvc.perform(
            post("/api/register")
                .with(csrf())
                .contentType("application/json")
                .content(
                    json.writeValueAsString(
                        Map.of("email", email, "name", "Okur", "password", "safe-password-123"))))
        .andExpect(status().isServiceUnavailable());
    assertEquals(
        0, db.queryForObject("select count(*) from members where email=?", Integer.class, email));
  }

  @Test
  void verificationRequiresCsrfAndRejectsMalformedTokens() throws Exception {
    mvc.perform(post("/api/email/verify").contentType("application/json").content("{}"))
        .andExpect(status().isForbidden());
    confirm("bad").andExpect(status().isBadRequest());
    confirm("a".repeat(64)).andExpect(status().isBadRequest());
    mvc.perform(
            post("/api/email/resend")
                .with(csrf())
                .contentType("application/json")
                .content("{\"email\":\"bad\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void simultaneousConfirmationsSucceedOnlyOnce() throws Exception {
    String token = register(email());
    try (var pool = Executors.newFixedThreadPool(2)) {
      var start = new CountDownLatch(1);
      Callable<Boolean> operation =
          () -> {
            start.await();
            try {
              verification.verify(token);
              return true;
            } catch (org.springframework.web.server.ResponseStatusException e) {
              return false;
            }
          };
      var first = pool.submit(operation);
      var second = pool.submit(operation);
      start.countDown();
      assertNotEquals(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));
    }
  }

  @Test
  void loginRateLimitReturns429InsteadOfUnlimitedAttempts() throws Exception {
    for (int i = 0; i < 15; i++)
      mvc.perform(
              post("/api/login")
                  .with(csrf())
                  .param("username", "missing@rate.test")
                  .param("password", "wrong"))
          .andExpect(status().isUnauthorized());
    mvc.perform(
            post("/api/login")
                .with(csrf())
                .param("username", "missing@rate.test")
                .param("password", "wrong"))
        .andExpect(status().isTooManyRequests())
        .andExpect(header().string("Retry-After", "600"));
  }

  @Test
  void securityHeadersAndInvalidQueries() throws Exception {
    mvc.perform(get("/"))
        .andExpect(status().isOk())
        .andExpect(header().exists("Content-Security-Policy"))
        .andExpect(header().string("Referrer-Policy", "no-referrer"))
        .andExpect(header().string("X-Content-Type-Options", "nosniff"));
    mvc.perform(get("/api/posts").param("page", "-1")).andExpect(status().isBadRequest());
    mvc.perform(get("/api/posts").param("page", "broken")).andExpect(status().isBadRequest());
    mvc.perform(get("/api/posts").param("category", "UNKNOWN")).andExpect(status().isBadRequest());
    mvc.perform(get("/api/posts").param("q", "x".repeat(201))).andExpect(status().isBadRequest());
  }

  @Test
  void oversizedAndMalformedJsonAreRejectedSafely() throws Exception {
    mvc.perform(
            post("/api/register")
                .with(csrf())
                .contentType("application/json")
                .content("x".repeat(524289)))
        .andExpect(status().isPayloadTooLarge());
    mvc.perform(post("/api/register").with(csrf()).contentType("application/json").content("{"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").exists());
  }

  @Test
  void unicodePasswordLimitIsEnforcedWithoutServerError() throws Exception {
    mvc.perform(
            post("/api/register")
                .with(csrf())
                .contentType("application/json")
                .content(
                    json.writeValueAsString(
                        Map.of("email", email(), "name", "Okur", "password", "ş".repeat(40)))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void paddedMixedCaseEmailsAreNormalizedBeforeValidation() throws Exception {
    String email = email();
    mvc.perform(
            post("/api/register")
                .with(csrf())
                .contentType("application/json")
                .content(
                    json.writeValueAsString(
                        Map.of(
                            "email",
                            "  " + email.toUpperCase(java.util.Locale.ROOT) + "  ",
                            "name",
                            "  Okur  ",
                            "password",
                            "safe-password-123"))))
        .andExpect(status().isCreated());
    verify(mailer).sendVerification(eq(email), anyString());
    assertEquals(
        "Okur", db.queryForObject("select name from members where email=?", String.class, email));
  }

  @Test
  void confirmationAndResendCanRaceWithoutDeadlock() throws Exception {
    String email = email(), token = register(email);
    db.update(
        "update email_verifications set sent_at=sent_at-61000 where token_hash=?",
        EmailVerification.hash(token));
    try (var pool = Executors.newFixedThreadPool(2)) {
      var start = new CountDownLatch(1);
      var confirm =
          pool.submit(
              () -> {
                start.await();
                try {
                  verification.verify(token);
                  return true;
                } catch (org.springframework.web.server.ResponseStatusException e) {
                  assertEquals(400, e.getStatusCode().value());
                  return false;
                }
              });
      var resend =
          pool.submit(
              () -> {
                start.await();
                verification.send(email);
                return true;
              });
      start.countDown();
      boolean confirmed = confirm.get(10, TimeUnit.SECONDS);
      assertTrue(resend.get(10, TimeUnit.SECONDS));
      assertTrue(
          confirmed
              || db.queryForObject(
                      "select count(*) from email_verifications where member_id=(select id from"
                          + " members where email=?)",
                      Integer.class,
                      email)
                  == 1);
    }
  }
}
