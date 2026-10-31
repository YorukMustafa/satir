package com.satir;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RequestLimits extends OncePerRequestFilter {
  private record Window(long end, int count) {}

  private final Map<String, Window> windows = new HashMap<>();
  private final Clock clock;

  public RequestLimits() {
    this(Clock.systemUTC());
  }

  RequestLimits(Clock clock) {
    this.clock = clock;
  }

  synchronized boolean allow(String key, int limit, long duration) {
    long now = clock.millis();
    if (windows.size() >= 10_000) windows.entrySet().removeIf(e -> e.getValue().end() <= now);
    Window window = windows.get(key);
    if (window == null || window.end() <= now) {
      if (windows.size() >= 10_000 && window == null) return false;
      windows.put(key, new Window(now + duration, 1));
      return true;
    }
    if (window.count() >= limit) return false;
    windows.put(key, new Window(window.end(), window.count() + 1));
    return true;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String path = request.getServletPath();
    if (path.isEmpty()) path = request.getRequestURI();
    if ("POST".equals(request.getMethod())) {
      String ip = request.getRemoteAddr();
      boolean accepted = true;
      if (path.equals("/api/login")) {
        String email = request.getParameter("username");
        if (email != null && email.length() > 254) email = email.substring(0, 254);
        accepted =
            allow("login-ip:" + ip, 50, 600_000)
                && allow(
                    "login-account:" + (email == null ? "" : email.trim().toLowerCase(Locale.ROOT)),
                    15,
                    600_000);
      } else if (path.equals("/api/register") || path.equals("/api/email/resend")) {
        accepted = allow("mail-ip:" + ip, 20, 3_600_000);
      } else if (path.equals("/api/email/verify")) {
        accepted = allow("verify-ip:" + ip, 60, 600_000);
      }
      if (!accepted) {
        response.setStatus(429);
        response.setHeader(
            "Retry-After", path.contains("email") || path.contains("register") ? "3600" : "600");
        response.setContentType("application/json;charset=UTF-8");
        response
            .getWriter()
            .write("{\"message\":\"Çok fazla deneme yapıldı. Lütfen biraz sonra yeniden dene.\"}");
        return;
      }
    }
    if (path.startsWith("/api/")
        && request.getContentType() != null
        && request.getContentType().toLowerCase(Locale.ROOT).startsWith("application/json")
        && java.util.Set.of("POST", "PUT", "PATCH").contains(request.getMethod())) {
      final int maxBytes = 524_288;
      byte[] body =
          request.getContentLengthLong() > maxBytes
              ? null
              : request.getInputStream().readNBytes(maxBytes + 1);
      if (body == null || body.length > maxBytes) {
        response.setStatus(413);
        response.setContentType("application/json;charset=UTF-8");
        response
            .getWriter()
            .write(
                "{\"message\":\"İstek çok büyük. Yazıyı veya alanları kısaltıp yeniden dene.\"}");
        return;
      }
      request =
          new jakarta.servlet.http.HttpServletRequestWrapper(request) {
            @Override
            public jakarta.servlet.ServletInputStream getInputStream() {
              var input = new java.io.ByteArrayInputStream(body);
              return new jakarta.servlet.ServletInputStream() {
                @Override
                public int read() {
                  return input.read();
                }

                @Override
                public int read(byte[] bytes, int offset, int length) {
                  return input.read(bytes, offset, length);
                }

                @Override
                public boolean isFinished() {
                  return input.available() == 0;
                }

                @Override
                public boolean isReady() {
                  return true;
                }

                @Override
                public void setReadListener(jakarta.servlet.ReadListener listener) {
                  throw new IllegalStateException("Synchronous JSON request");
                }
              };
            }

            @Override
            public java.io.BufferedReader getReader() {
              return new java.io.BufferedReader(
                  new java.io.InputStreamReader(
                      getInputStream(), java.nio.charset.StandardCharsets.UTF_8));
            }

            @Override
            public int getContentLength() {
              return body.length;
            }

            @Override
            public long getContentLengthLong() {
              return body.length;
            }
          };
    }
    chain.doFilter(request, response);
  }
}
