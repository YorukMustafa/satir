package com.satir;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class AdminBootstrap implements ApplicationRunner {
  private final JdbcTemplate db;
  private final PasswordEncoder encoder;
  private final String email, password;

  public AdminBootstrap(
      JdbcTemplate db,
      PasswordEncoder encoder,
      @Value("${ADMIN_EMAIL:}") String email,
      @Value("${ADMIN_PASSWORD:}") String password) {
    this.db = db;
    this.encoder = encoder;
    this.email = email.trim().toLowerCase();
    this.password = password;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (db.queryForObject("select count(*) from members where role='ADMIN'", Integer.class) > 0)
      return;
    if (email.isBlank() && password.isBlank()) return;
    if (!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")
        || email.length() > 254
        || password.length() < 10
        || password.getBytes(StandardCharsets.UTF_8).length > 72)
      throw new IllegalStateException(
          "İlk admin için geçerli ADMIN_EMAIL ve 10–72 bayt ADMIN_PASSWORD gerekli.");
    if (db.queryForObject("select count(*) from members where email=?", Integer.class, email) > 0)
      throw new IllegalStateException(
          "ADMIN_EMAIL mevcut bir hesaba ait. İlk admin için kullanılmamış bir e-posta seç.");
    db.update(
        "insert into members values(?,?,?,?,?)",
        UUID.randomUUID().toString(),
        "Yönetici",
        email,
        encoder.encode(password),
        "ADMIN");
  }
}
