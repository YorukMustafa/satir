package com.satir;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(
    properties = {
      "APP_PUBLIC_URL=https://satir.example",
      "ADMIN_EMAIL=admin@pg-audit.test",
      "ADMIN_PASSWORD=safe-password-123"
    })
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "SATIR_TEST_POSTGRES_URL", matches = ".+")
class PostgresAuditTest {
  @DynamicPropertySource
  static void postgres(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", () -> System.getenv("SATIR_TEST_POSTGRES_URL"));
    registry.add("spring.datasource.username", () -> "postgres");
    registry.add("spring.datasource.password", () -> "");
  }

  @Autowired JdbcTemplate db;
  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @MockitoBean VerificationMailer mailer;

  @Test
  void postgres18SchemaAndAdminAreCorrect() throws Exception {
    try (var c = db.getDataSource().getConnection()) {
      assertEquals("PostgreSQL", c.getMetaData().getDatabaseProductName());
      assertEquals(18, c.getMetaData().getDatabaseMajorVersion());
    }
    assertEquals(
        "3",
        db.queryForObject(
            "select version from flyway_schema_history where success=true order by installed_rank"
                + " desc limit 1",
            String.class));
    assertTrue(
        db.queryForObject(
            "select email_verified from members where email='admin@pg-audit.test'", Boolean.class));
    assertEquals(
        1,
        db.queryForObject(
            "select count(*) from information_schema.columns where table_schema='public' and"
                + " table_name='members' and column_name='id' and is_nullable='NO'",
            Integer.class));
    assertThrows(
        org.springframework.dao.DataIntegrityViolationException.class,
        () ->
            db.update(
                "insert into members(id,name,email,password,role)"
                    + " values(null,'Invalid','null@pg-audit.test','hash','READER')"));
  }

  @Test
  void realPostgresRegistrationVerificationAndLogin() throws Exception {
    when(mailer.configured()).thenReturn(true);
    String email = UUID.randomUUID() + "@pg-audit.test";
    mvc.perform(
            post("/api/register")
                .with(csrf())
                .contentType("application/json")
                .content(
                    json.writeValueAsString(
                        Map.of(
                            "name", "PG Okur", "email", email, "password", "safe-password-123"))))
        .andExpect(status().isCreated());
    var link = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(mailer).sendVerification(eq(email), link.capture());
    String token = link.getValue().split("token=")[1];
    mvc.perform(
            post("/api/email/verify")
                .with(csrf())
                .contentType("application/json")
                .content(json.writeValueAsString(Map.of("token", token))))
        .andExpect(status().isOk());
    mvc.perform(
            post("/api/login")
                .with(csrf())
                .param("username", email)
                .param("password", "safe-password-123"))
        .andExpect(status().isNoContent());
    assertTrue(
        db.queryForObject(
            "select email_verified from members where email=?", Boolean.class, email));
  }
}
