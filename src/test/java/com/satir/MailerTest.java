package com.satir;

import static org.junit.jupiter.api.Assertions.*;

import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class MailerTest {
  @Test
  void sendsExpectedHttpsApiPayloadAndHandlesProviderRejection() throws Exception {
    var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    var payload = new AtomicReference<String>();
    var key = new AtomicReference<String>();
    var status = new java.util.concurrent.atomic.AtomicInteger(201);
    server.createContext(
        "/email",
        exchange -> {
          payload.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
          key.set(exchange.getRequestHeaders().getFirst("api-key"));
          exchange.sendResponseHeaders(status.get(), -1);
          exchange.close();
        });
    server.start();
    try {
      var json = new ObjectMapper();
      var mailer =
          new BrevoMailer(
              "synthetic-test-key",
              "sender@example.test",
              json,
              HttpClient.newHttpClient(),
              URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/email"));
      assertTrue(mailer.configured());
      mailer.sendVerification(
          "reader@example.test", "https://satir.example/#verify?token=test-token");
      assertEquals("synthetic-test-key", key.get());
      var body = json.readTree(payload.get());
      assertEquals("reader@example.test", body.get("to").get(0).get("email").asText());
      assertTrue(body.get("textContent").asText().contains("30 dakika"));
      assertTrue(body.get("textContent").asText().contains("#verify?token=test-token"));
      status.set(429);
      var e =
          assertThrows(
              org.springframework.web.server.ResponseStatusException.class,
              () -> mailer.sendVerification("reader@example.test", "https://satir.example"));
      assertEquals(503, e.getStatusCode().value());
      assertFalse(e.getReason().contains("synthetic-test-key"));
    } finally {
      server.stop(0);
    }
  }

  @Test
  void missingCredentialsAreNeverConsideredConfigured() {
    assertFalse(new BrevoMailer("", "sender@example.test", new ObjectMapper()).configured());
    assertFalse(new BrevoMailer("key", "bad", new ObjectMapper()).configured());
  }

  @Test
  void limiterWindowExpires() {
    class TestClock extends java.time.Clock {
      long at = 0;

      public java.time.ZoneId getZone() {
        return java.time.ZoneOffset.UTC;
      }

      public java.time.Clock withZone(java.time.ZoneId zone) {
        return this;
      }

      public java.time.Instant instant() {
        return java.time.Instant.ofEpochMilli(at);
      }
    }
    var clock = new TestClock();
    var limits = new RequestLimits(clock);
    assertTrue(limits.allow("test", 2, 1000));
    assertTrue(limits.allow("test", 2, 1000));
    assertFalse(limits.allow("test", 2, 1000));
    clock.at = 1000;
    assertTrue(limits.allow("test", 2, 1000));
  }

  @Test
  void unknownLengthOversizedJsonIsAlsoBounded() throws Exception {
    var request =
        new org.springframework.mock.web.MockHttpServletRequest() {
          @Override
          public long getContentLengthLong() {
            return -1;
          }
        };
    request.setMethod("POST");
    request.setRequestURI("/api/email/verify");
    request.setContentType("application/json");
    request.setContent("x".repeat(524289).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    var response = new org.springframework.mock.web.MockHttpServletResponse();
    var reached = new java.util.concurrent.atomic.AtomicBoolean(false);
    new RequestLimits().doFilter(request, response, (r, s) -> reached.set(true));
    assertEquals(413, response.getStatus());
    assertFalse(reached.get());
  }
}
