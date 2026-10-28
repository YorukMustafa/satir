package com.satir;

import static org.junit.jupiter.api.Assertions.*;

import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

class DeploymentTest {
  @Test
  void renderConnectionUsesJdbcTlsAndDoesNotExposeCredentials() {
    assertEquals(
        "jdbc:postgresql://internal.example:5432/satir?sslmode=require",
        RenderDatabaseConfig.jdbcUrl("postgresql://user:secret@internal.example:5432/satir"));
    assertEquals(
        "jdbc:postgresql://internal.example:5432/satir?sslmode=require",
        RenderDatabaseConfig.jdbcUrl("postgres://user:secret@internal.example/satir"));
    assertThrows(
        IllegalArgumentException.class,
        () -> RenderDatabaseConfig.jdbcUrl("https://example.com/satir"));
  }

  @Test
  void upgradePreservesPostsAndRequiresApprovalForFormerPublicWriters() throws Exception {
    String url = "jdbc:h2:mem:upgrade;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
    Flyway.configure().dataSource(url, "sa", "").target("1").load().migrate();
    try (var c = DriverManager.getConnection(url, "sa", "");
        var q = c.createStatement()) {
      q.executeUpdate(
          "insert into members values('old-writer','Old"
              + " Writer','old@example.test','hash','WRITER')");
      q.executeUpdate(
          "insert into posts"
              + " values('old-post','old-writer','Title','Summary','Content','BLOG','',null,false,true,'2026-10-28','2026-10-28')");
    }
    Flyway.configure().dataSource(url, "sa", "").load().migrate();
    try (var c = DriverManager.getConnection(url, "sa", "");
        var q = c.createStatement()) {
      try (var r = q.executeQuery("select role from members where id='old-writer'")) {
        assertTrue(r.next());
        assertEquals("READER", r.getString(1));
      }
      try (var r = q.executeQuery("select body from posts where id='old-post'")) {
        assertTrue(r.next());
        assertEquals("Content", r.getString(1));
      }
      q.executeUpdate("update members set role='ADMIN' where id='old-writer'");
      q.executeUpdate("update posts set category='HISTORY' where id='old-post'");
    }
  }
}
