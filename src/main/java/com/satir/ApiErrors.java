package com.satir;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiErrors {
  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<?> status(ResponseStatusException error) {
    return ResponseEntity.status(error.getStatusCode())
        .body(
            Map.of(
                "message",
                error.getReason() == null ? "İşlem gerçekleştirilemedi." : error.getReason()));
  }

  @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
  ResponseEntity<?> fields(org.springframework.web.bind.MethodArgumentNotValidException error) {
    var field = error.getBindingResult().getFieldErrors().stream().findFirst();
    String message =
        switch (field.map(e -> e.getField()).orElse("")) {
          case "email" -> "Geçerli bir e-posta adresi yaz.";
          case "password" -> "Şifren 10–72 karakter olmalı; UTF-8 olarak 72 baytı geçmemeli.";
          case "name" -> "Adın boş olmamalı ve 80 karakteri geçmemeli.";
          case "title" -> "Başlık boş olmamalı ve 180 karakteri geçmemeli.";
          case "summary" -> "Özet boş olmamalı ve 400 karakteri geçmemeli.";
          case "body" -> "İçeriği boş bırakma ve belirtilen uzunluk sınırını aşma.";
          case "rating" -> "Değerlendirme puanı 1 ile 10 arasında olmalı.";
          case "category" -> "Geçerli bir yazı türü seç.";
          case "token" -> "Doğrulama bağlantısı geçersiz. Yeni bağlantı isteyebilirsin.";
          default -> "Alanları kontrol edip yeniden dene.";
        };
    return badRequest(message);
  }

  @ExceptionHandler({
    org.springframework.web.method.annotation.HandlerMethodValidationException.class,
    jakarta.validation.ConstraintViolationException.class,
    org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class
  })
  ResponseEntity<?> invalidQuery(Exception error) {
    return badRequest("Arama, kategori veya sayfa bilgisi geçersiz.");
  }

  @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
  ResponseEntity<?> invalidBody(Exception error) {
    return badRequest("İstek okunamadı. Alanları kontrol edip yeniden dene.");
  }

  private ResponseEntity<?> badRequest(String message) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", message));
  }
}
