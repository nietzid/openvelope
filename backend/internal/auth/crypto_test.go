package auth

import "testing"

func TestEncryptDecrypt(t *testing.T) {
	key := "0123456789abcdef0123456789abcdef"
	plaintext := `{"email":"user@example.com","password":"secret123"}`

	encrypted, err := Encrypt(plaintext, key)
	if err != nil {
		t.Fatalf("Encrypt() error: %v", err)
	}

	if encrypted == plaintext {
		t.Error("Encrypt() returned plaintext unchanged")
	}

	decrypted, err := Decrypt(encrypted, key)
	if err != nil {
		t.Fatalf("Decrypt() error: %v", err)
	}

	if decrypted != plaintext {
		t.Errorf("Decrypt() = %q, want %q", decrypted, plaintext)
	}
}

func TestDecryptWrongKey(t *testing.T) {
	key1 := "0123456789abcdef0123456789abcdef"
	key2 := "abcdef0123456789abcdef0123456789"

	encrypted, err := Encrypt("secret data", key1)
	if err != nil {
		t.Fatalf("Encrypt() error: %v", err)
	}

	_, err = Decrypt(encrypted, key2)
	if err == nil {
		t.Error("Decrypt() expected error for wrong key")
	}
}

func TestEncryptInvalidKeyLength(t *testing.T) {
	_, err := Encrypt("data", "short-key")
	if err == nil {
		t.Error("Encrypt() expected error for invalid key length")
	}
}
