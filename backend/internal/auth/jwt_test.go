package auth

import (
	"testing"
	"time"
)

func TestGenerateAndValidateAccessToken(t *testing.T) {
	secret := "test-secret-key-for-jwt"
	email := "user@example.com"

	token, err := GenerateAccessToken(email, secret, 15*time.Minute)
	if err != nil {
		t.Fatalf("GenerateAccessToken() error: %v", err)
	}

	claims, err := ValidateToken(token, secret)
	if err != nil {
		t.Fatalf("ValidateToken() error: %v", err)
	}

	if claims.Email != email {
		t.Errorf("claims.Email = %q, want %q", claims.Email, email)
	}
	if claims.TokenType != "access" {
		t.Errorf("claims.TokenType = %q, want %q", claims.TokenType, "access")
	}
}

func TestValidateExpiredToken(t *testing.T) {
	secret := "test-secret-key-for-jwt"
	email := "user@example.com"

	token, err := GenerateAccessToken(email, secret, -1*time.Minute)
	if err != nil {
		t.Fatalf("GenerateAccessToken() error: %v", err)
	}

	_, err = ValidateToken(token, secret)
	if err == nil {
		t.Error("ValidateToken() expected error for expired token")
	}
}

func TestValidateWrongSecret(t *testing.T) {
	token, err := GenerateAccessToken("user@example.com", "secret1", 15*time.Minute)
	if err != nil {
		t.Fatalf("GenerateAccessToken() error: %v", err)
	}

	_, err = ValidateToken(token, "secret2")
	if err == nil {
		t.Error("ValidateToken() expected error for wrong secret")
	}
}

func TestGenerateRefreshToken(t *testing.T) {
	token, err := GenerateRefreshToken()
	if err != nil {
		t.Fatalf("GenerateRefreshToken() error: %v", err)
	}

	if len(token) < 32 {
		t.Errorf("refresh token too short: %d chars", len(token))
	}
}
