package com.satir;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class EmailVerification {
  private final JdbcTemplate db;
  private final VerificationMailer mailer;
  private final String publicUrl;
  private final Clock clock;
  private final SecureRandom random = new SecureRandom();

  @org.springframework.beans.factory.annotation.Autowired
  public EmailVerification(
      JdbcTemplate db,
      VerificationMailer mailer,
      @Value("${APP_PUBLIC_URL:http://localhost:8080}") String publicUrl) {
    this(db, mailer, publicUrl, Clock.systemUTC());
  }

  EmailVerification(JdbcTemplate db, VerificationMailer mailer, String publicUrl, Clock clock) {
    this.db = db;
    this.mailer = mailer;
    var uri = URI.create(publicUrl);
    boolean local =
        "http".equals(uri.getScheme())
            && ("localhost".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost()));
    if ((!"https".equals(uri.getScheme()) && !local)
        || uri.getHost() == null
        || uri.getRawUserInfo() != null
        || uri.getRawQuery() != null
        || uri.getRawFragment() != null
        || (!uri.getPath().isEmpty() && !uri.getPath().equals("/"))) {
      throw new IllegalArgumentException("APP_PUBLIC_URL güvenilir, kök HTTPS adresi olmalı.");
    }
    this.publicUrl = publicUrl.replaceAll("/+$", "");
    this.clock = clock;
  }

  void requireDelivery() {
    if (!mailer.configured()) throw BrevoMailer.unavailable();
  }

  @Transactional
  public void send(String email) {
    requireDelivery();
    // Lock the member across resend requests; quotas survive app restarts.
    var users =
        db.queryForList("select id,email_verified from members where email=? for update", email);
    if (users.isEmpty() || Boolean.TRUE.equals(users.getFirst().get("email_verified"))) return;
    String id = (String) users.getFirst().get("id");
    var rows = db.queryForList("select * from email_verifications where member_id=?", id);
    long now = clock.millis(), window = now;
    int count = 1;
    if (!rows.isEmpty()) {
      var row = rows.getFirst();
      long sent = ((Number) row.get("sent_at")).longValue();
      window = ((Number) row.get("window_started_at")).longValue();
      if (now - sent < 60_000) throw limited();
      if (now - window < 3_600_000) {
        count = ((Number) row.get("sent_count")).intValue() + 1;
        if (count > 5) throw limited();
      } else window = now;
    }
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    String token = HexFormat.of().formatHex(bytes);
    db.update("delete from email_verifications where member_id=?", id);
    db.update(
        "insert into email_verifications values(?,?,?,?,?,?)",
        id,
        hash(token),
        now + 1_800_000,
        now,
        window,
        count);
    mailer.sendVerification(email, publicUrl + "/#verify?token=" + token);
  }

  @Transactional
  public void verify(String token) {
    if (token == null || !token.matches("[0-9a-f]{64}")) throw invalid();
    // Keep the same member-then-token lock order as resend, avoiding deadlocks.
    var owners =
        db.queryForList(
            "select member_id from email_verifications where token_hash=?", hash(token));
    if (owners.isEmpty()) throw invalid();
    String owner = (String) owners.getFirst().get("member_id");
    if (db.queryForList("select id from members where id=? for update", owner).isEmpty())
      throw invalid();
    var rows =
        db.queryForList(
            "select member_id,expires_at from email_verifications where token_hash=? for update",
            hash(token));
    if (rows.isEmpty()
        || ((Number) rows.getFirst().get("expires_at")).longValue() <= clock.millis())
      throw invalid();
    String id = (String) rows.getFirst().get("member_id");
    db.update("update members set email_verified=true where id=?", id);
    db.update("delete from email_verifications where member_id=?", id);
  }

  static String hash(String token) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }

  private static ResponseStatusException limited() {
    return new ResponseStatusException(
        HttpStatus.TOO_MANY_REQUESTS,
        "Yeni bağlantı için en az 1 dakika bekle. Saatte en fazla 5 e-posta gönderilebilir.");
  }

  private static ResponseStatusException invalid() {
    return new ResponseStatusException(
        HttpStatus.BAD_REQUEST,
        "Bu doğrulama bağlantısı geçersiz veya süresi dolmuş. Yeni bağlantı isteyebilirsin.");
  }
}
