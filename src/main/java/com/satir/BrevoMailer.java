package com.satir;

import tools.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class BrevoMailer implements VerificationMailer {
  private final String key, from;
  private final ObjectMapper json;
  private final HttpClient client;
  private final URI endpoint;

  @org.springframework.beans.factory.annotation.Autowired
  public BrevoMailer(
      @Value("${BREVO_API_KEY:}") String key,
      @Value("${MAIL_FROM:}") String from,
      ObjectMapper json) {
    this(
        key,
        from,
        json,
        HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build(),
        URI.create("https://api.brevo.com/v3/smtp/email"));
  }

  // The endpoint override is available only to package-local transport tests.
  BrevoMailer(String key, String from, ObjectMapper json, HttpClient client, URI endpoint) {
    this.key = key.trim();
    this.from = from.trim();
    this.json = json;
    this.client = client;
    this.endpoint = endpoint;
  }

  @Override
  public boolean configured() {
    return !key.isBlank() && from.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+") && from.length() <= 254;
  }

  @Override
  public void sendVerification(String email, String link) {
    if (!configured()) throw unavailable();
    try {
      String content =
          "Satır hesabının e-posta adresini doğrulamak için aşağıdaki bağlantıyı aç:\n\n"
              + link
              + "\n\nBağlantı 30 dakika geçerlidir ve yalnızca bir kez kullanılabilir."
              + "\nBu isteği sen yapmadıysan e-postayı yok sayabilirsin.";
      String body =
          json.writeValueAsString(
              Map.of(
                  "sender",
                  Map.of("name", "Satır", "email", from),
                  "to",
                  List.of(Map.of("email", email)),
                  "subject",
                  "Satır · E-posta adresini doğrula",
                  "textContent",
                  content));
      var request =
          HttpRequest.newBuilder(endpoint)
              .timeout(Duration.ofSeconds(10))
              .header("api-key", key)
              .header("Accept", "application/json")
              .header("Content-Type", "application/json")
              .POST(HttpRequest.BodyPublishers.ofString(body))
              .build();
      var response = client.send(request, HttpResponse.BodyHandlers.discarding());
      if (response.statusCode() != 201) throw unavailable();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw unavailable();
    } catch (java.io.IOException | IllegalArgumentException e) {
      throw unavailable();
    }
  }

  static ResponseStatusException unavailable() {
    return new ResponseStatusException(
        HttpStatus.SERVICE_UNAVAILABLE,
        "Doğrulama e-postası şu anda gönderilemiyor. Lütfen biraz sonra yeniden dene.");
  }
}
