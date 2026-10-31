package com.satir;

import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class Security {
  @Bean
  PasswordEncoder encoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  UserDetailsService users(JdbcTemplate db) {
    return email ->
        db
            .query(
                "select * from members where email=?",
                (r, n) ->
                    User.withUsername(r.getString("email"))
                        .password(r.getString("password"))
                        .roles(r.getString("role"))
                        .disabled(!r.getBoolean("email_verified"))
                        .build(),
                email.toLowerCase(java.util.Locale.ROOT).trim())
            .stream()
            .findFirst()
            .orElseThrow(() -> new UsernameNotFoundException("Hesap bulunamadı"));
  }

  @Bean
  org.springframework.boot.web.servlet.FilterRegistrationBean<RequestLimits> limitRegistration(
      RequestLimits limits) {
    var registration = new org.springframework.boot.web.servlet.FilterRegistrationBean<>(limits);
    registration.setEnabled(false);
    return registration;
  }

  @Bean
  SecurityFilterChain chain(HttpSecurity http, RequestLimits limits) throws Exception {
    http.authorizeHttpRequests(
            a ->
                a.requestMatchers(
                        "/api/me",
                        "/api/csrf",
                        "/api/register",
                        "/api/email/verify",
                        "/api/email/resend")
                    .permitAll()
                    .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/posts/**")
                    .permitAll()
                    .requestMatchers("/api/admin/**")
                    .hasRole("ADMIN")
                    .requestMatchers("/api/**")
                    .authenticated()
                    .anyRequest()
                    .permitAll())
        .formLogin(
            f ->
                f.loginProcessingUrl("/api/login")
                    .successHandler((q, s, a) -> s.setStatus(204))
                    .failureHandler(
                        (q, s, e) -> {
                          boolean pending =
                              e
                                  instanceof
                                  org.springframework.security.authentication.DisabledException;
                          s.setStatus(pending ? 403 : 401);
                          s.setContentType("application/json;charset=UTF-8");
                          s.getWriter()
                              .write(
                                  pending
                                      ? "{\"message\":\"Giriş yapmadan önce e-posta adresini"
                                            + " doğrula.\",\"code\":\"EMAIL_NOT_VERIFIED\"}"
                                      : "{\"message\":\"E-posta veya şifre yanlış.\"}");
                        }))
        .logout(l -> l.logoutUrl("/api/logout").logoutSuccessHandler((q, s, a) -> s.setStatus(204)))
        .exceptionHandling(
            e ->
                e.authenticationEntryPoint((q, s, x) -> s.sendError(401))
                    .accessDeniedHandler((q, s, x) -> s.sendError(403)));
    http.addFilterBefore(
        limits,
        org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class);
    http.headers(
        h ->
            h.contentSecurityPolicy(
                    c ->
                        c.policyDirectives(
                            "default-src 'self'; script-src 'self'; style-src 'self'; img-src"
                                + " 'self' data:; font-src 'self'; connect-src 'self'; object-src"
                                + " 'none'; base-uri 'self'; frame-ancestors 'none'; form-action"
                                + " 'self'"))
                .referrerPolicy(
                    r ->
                        r.policy(
                            org.springframework.security.web.header.writers
                                .ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER)));
    return http.build();
  }
}
