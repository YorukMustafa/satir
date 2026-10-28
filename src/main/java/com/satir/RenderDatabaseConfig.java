package com.satir;

import com.zaxxer.hikari.HikariDataSource;
import java.net.URI;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;

@Configuration
@Profile("render")
public class RenderDatabaseConfig {
  static String jdbcUrl(String connection) {
    URI uri = URI.create(connection);
    if (!("postgresql".equals(uri.getScheme()) || "postgres".equals(uri.getScheme()))
        || uri.getHost() == null
        || uri.getRawPath() == null
        || uri.getRawPath().length() < 2)
      throw new IllegalArgumentException(
          "RENDER_DATABASE_URL geçerli bir PostgreSQL bağlantısı olmalı.");
    return "jdbc:postgresql://"
        + uri.getHost()
        + ":"
        + (uri.getPort() < 0 ? 5432 : uri.getPort())
        + uri.getRawPath()
        + "?sslmode=require";
  }

  @Bean
  DataSource renderDataSource(
      @Value("${RENDER_DATABASE_URL}") String connection,
      @Value("${DATABASE_USER}") String user,
      @Value("${DATABASE_PASSWORD}") String password) {
    var source = new HikariDataSource();
    source.setJdbcUrl(jdbcUrl(connection));
    source.setUsername(user);
    source.setPassword(password);
    source.setMaximumPoolSize(5);
    return source;
  }
}
