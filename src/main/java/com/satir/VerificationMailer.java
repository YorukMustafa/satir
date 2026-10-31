package com.satir;

public interface VerificationMailer {
  boolean configured();

  void sendVerification(String email, String link);
}
