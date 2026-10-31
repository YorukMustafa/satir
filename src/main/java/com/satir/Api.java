package com.satir;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.time.Instant;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class Api {
  final JdbcTemplate db;
  final PasswordEncoder passwords;
  final EmailVerification verification;

  Api(JdbcTemplate db, PasswordEncoder passwords, EmailVerification verification) {
    this.db = db;
    this.passwords = passwords;
    this.verification = verification;
  }

  record Registration(
      @NotBlank @Size(max = 80) String name,
      @NotBlank @Email @Size(max = 254) String email,
      @Size(min = 10, max = 72) @NotNull String password) {
    Registration {
      if (name != null) name = name.strip();
      if (email != null) email = email.strip().toLowerCase(Locale.ROOT);
    }
  }

  record PostInput(
      @NotBlank @Size(max = 180) String title,
      @NotBlank @Size(max = 400) String summary,
      @NotBlank @Size(max = 100000) String body,
      @NotNull @Pattern(regexp = "BLOG|FILM|SERIES|HISTORY|TECH|SPORT") String category,
      @NotNull @Size(max = 160) String workTitle,
      @Min(1) @Max(10) Integer rating,
      boolean spoiler,
      boolean published) {}

  record CommentInput(@NotBlank @Size(max = 2000) String body) {}

  String id() {
    return UUID.randomUUID().toString();
  }

  String now() {
    return Instant.now().toString();
  }

  Map<String, Object> member(Principal p) {
    if (p == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    return db.queryForMap(
        "select id,name,email,role,email_verified from members where email=?", p.getName());
  }

  record VerifyInput(@NotBlank @Pattern(regexp = "[0-9a-f]{64}") String token) {}

  @PostMapping("/email/verify")
  Object verifyEmail(@Valid @RequestBody VerifyInput input) {
    verification.verify(input.token());
    return Map.of("message", "E-posta adresin doğrulandı. Giriş yapabilirsin.");
  }

  @PostMapping("/email/resend")
  Object resendEmail(@Valid @RequestBody EmailInput input) {
    verification.send(input.email().trim().toLowerCase(Locale.ROOT));
    return Map.of("message", "Bu adresle doğrulanmamış bir hesap varsa yeni bağlantı gönderildi.");
  }

  @GetMapping("/csrf")
  Map<String, String> csrf(CsrfToken t) {
    return Map.of("token", t.getToken(), "header", t.getHeaderName());
  }

  @GetMapping("/me")
  Object me(Principal p) {
    return p == null ? Map.of() : member(p);
  }

  @org.springframework.transaction.annotation.Transactional
  @PostMapping("/register")
  @ResponseStatus(HttpStatus.CREATED)
  Object register(@Valid @RequestBody Registration r) {
    return createAccount(r, "READER");
  }

  Object createAccount(Registration r, String role) {
    verification.requireDelivery();
    if (r.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Şifre UTF-8 olarak en fazla 72 bayt olabilir");
    String id = id();
    try {
      db.update(
          "insert into members(id,name,email,password,role,email_verified) values(?,?,?,?,?,false)",
          id,
          r.name().trim(),
          r.email().toLowerCase(Locale.ROOT).trim(),
          passwords.encode(r.password()),
          role);
    } catch (DataIntegrityViolationException e) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Bu e-posta zaten kullanılıyor");
    }
    verification.send(r.email().toLowerCase(Locale.ROOT).trim());
    return Map.of("id", id, "verificationRequired", true);
  }

  void admin(Principal p) {
    if (!"ADMIN".equals(member(p).get("role")))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  }

  @GetMapping("/admin/writers")
  Object writers(Principal p) {
    admin(p);
    return db.queryForList(
        "select id,name,email,role,email_verified from members where role='WRITER' order by name");
  }

  @org.springframework.transaction.annotation.Transactional
  @PostMapping("/admin/writers")
  @ResponseStatus(HttpStatus.CREATED)
  Object addWriter(@Valid @RequestBody Registration r, Principal p) {
    admin(p);
    return createAccount(r, "WRITER");
  }

  record EmailInput(@NotBlank @Email @Size(max = 254) String email) {
    EmailInput {
      if (email != null) email = email.strip().toLowerCase(Locale.ROOT);
    }
  }

  @PostMapping("/admin/writers/promote")
  Object promote(@Valid @RequestBody EmailInput r, Principal p) {
    admin(p);
    String email = r.email().trim().toLowerCase(Locale.ROOT);
    if (db.update(
            "update members set role='WRITER' where email=? and role='READER' and"
                + " email_verified=true",
            email)
        == 0)
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "Bu e-postayla doğrulanmış bir okuyucu bulunamadı.");
    return Map.of("message", "Yazar yetkisi verildi");
  }

  final String SELECT =
      "select p.*,m.name as author_name from posts p join members m on p.author_id=m.id ";

  Map<String, Object> post(String id, Principal p) {
    var list = db.queryForList(SELECT + "where p.id=?", id);
    if (list.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    var row = list.getFirst();
    if (!Boolean.TRUE.equals(row.get("published"))
        && (p == null || !row.get("author_id").equals(member(p).get("id"))))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return row;
  }

  void owner(String id, Principal p) {
    if (!post(id, p).get("author_id").equals(member(p).get("id")))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  }

  @GetMapping("/posts")
  Object posts(
      @RequestParam(defaultValue = "") @Size(max = 200) String q,
      @RequestParam(defaultValue = "") @Pattern(regexp = "|BLOG|FILM|SERIES|HISTORY|TECH|SPORT")
          String category,
      @RequestParam(defaultValue = "0") @Min(0) @Max(10000) int page) {
    return db.queryForList(
        SELECT
            + "where p.published=true and (?='' or p.category=?) and (lower(p.title) like ? or"
            + " lower(p.summary) like ?) order by p.created_at desc limit 20 offset ?",
        category,
        category,
        "%" + q.toLowerCase(Locale.ROOT) + "%",
        "%" + q.toLowerCase(Locale.ROOT) + "%",
        Math.min(Math.max(page, 0), 10000) * 20);
  }

  @GetMapping("/posts/{id}")
  Object detail(@PathVariable String id, Principal p) {
    return post(id, p);
  }

  @GetMapping("/mine")
  Object mine(Principal p) {
    writer(p);
    return db.queryForList(
        SELECT + "where p.author_id=? order by p.updated_at desc", member(p).get("id"));
  }

  void writer(Principal p) {
    if (!Set.of("WRITER", "ADMIN").contains(member(p).get("role")))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Yazar hesabı gerekli");
  }

  void validate(PostInput r) {
    if (Set.of("FILM", "SERIES").contains(r.category())
        && (r.workTitle().isBlank() || r.rating() == null))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Eser adı ve 1–10 puan gerekli");
  }

  @PostMapping("/posts")
  @ResponseStatus(HttpStatus.CREATED)
  Object create(@Valid @RequestBody PostInput r, Principal p) {
    writer(p);
    validate(r);
    String id = id(), at = now();
    db.update(
        "insert into posts values(?,?,?,?,?,?,?,?,?,?,?,?)",
        id,
        member(p).get("id"),
        r.title(),
        r.summary(),
        r.body(),
        r.category(),
        r.workTitle(),
        r.rating(),
        r.spoiler(),
        r.published(),
        at,
        at);
    return post(id, p);
  }

  @PutMapping("/posts/{id}")
  Object update(@PathVariable String id, @Valid @RequestBody PostInput r, Principal p) {
    writer(p);
    owner(id, p);
    validate(r);
    db.update(
        "update posts set"
            + " title=?,summary=?,body=?,category=?,work_title=?,rating=?,spoiler=?,published=?,updated_at=?"
            + " where id=?",
        r.title(),
        r.summary(),
        r.body(),
        r.category(),
        r.workTitle(),
        r.rating(),
        r.spoiler(),
        r.published(),
        now(),
        id);
    return post(id, p);
  }

  @DeleteMapping("/posts/{id}")
  void delete(@PathVariable String id, Principal p) {
    writer(p);
    owner(id, p);
    db.update("delete from posts where id=?", id);
  }

  @GetMapping("/posts/{id}/comments")
  Object comments(@PathVariable String id, Principal p) {
    post(id, p);
    return db.queryForList(
        "select c.id,c.body,c.created_at,m.name as author_name from comments c join members m on"
            + " m.id=c.member_id where c.post_id=? order by c.created_at",
        id);
  }

  @PostMapping("/posts/{id}/comments")
  @ResponseStatus(HttpStatus.CREATED)
  void comment(@PathVariable String id, @Valid @RequestBody CommentInput r, Principal p) {
    var row = post(id, p);
    if (!Boolean.TRUE.equals(row.get("published")))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
    db.update(
        "insert into comments values(?,?,?,?,?)", id(), id, member(p).get("id"), r.body(), now());
  }

  @GetMapping("/bookmarks")
  Object bookmarks(Principal p) {
    return db.queryForList(
        SELECT
            + "join bookmarks b on b.post_id=p.id where b.member_id=? and p.published=true order by"
            + " p.created_at desc",
        member(p).get("id"));
  }

  @PutMapping("/bookmarks/{id}")
  void save(@PathVariable String id, Principal p) {
    var row = post(id, p);
    if (!Boolean.TRUE.equals(row.get("published")))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
    try {
      db.update("insert into bookmarks values(?,?)", member(p).get("id"), id);
    } catch (DataIntegrityViolationException ignored) {
    }
  }

  @DeleteMapping("/bookmarks/{id}")
  void unsave(@PathVariable String id, Principal p) {
    db.update("delete from bookmarks where member_id=? and post_id=?", member(p).get("id"), id);
  }
}
