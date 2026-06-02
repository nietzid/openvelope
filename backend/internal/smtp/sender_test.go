package smtp

import (
	"strings"
	"testing"
)

func TestBuildMessage(t *testing.T) {
	msg := EmailMessage{
		From:    "sender@example.com",
		To:      []string{"recipient@example.com"},
		Cc:      []string{"cc@example.com"},
		Subject: "Test Subject",
		Body:    "<p>Hello World</p>",
		IsHTML:  true,
	}

	raw, err := BuildMessage(msg)
	if err != nil {
		t.Fatalf("BuildMessage() error: %v", err)
	}

	rawStr := string(raw)
	for _, want := range []string{
		"From: sender@example.com",
		"To: recipient@example.com",
		"Cc: cc@example.com",
		"Subject: Test Subject",
		"Content-Type: text/html",
	} {
		if !strings.Contains(rawStr, want) {
			t.Errorf("missing %q in message", want)
		}
	}
}

func TestBuildMessagePlainText(t *testing.T) {
	msg := EmailMessage{
		From:    "sender@example.com",
		To:      []string{"recipient@example.com"},
		Subject: "Test",
		Body:    "Hello World",
		IsHTML:  false,
	}

	raw, err := BuildMessage(msg)
	if err != nil {
		t.Fatalf("BuildMessage() error: %v", err)
	}

	if !strings.Contains(string(raw), "Content-Type: text/plain") {
		t.Error("missing plain text content type")
	}
}
