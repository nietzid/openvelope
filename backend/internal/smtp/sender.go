package smtp

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strings"
	"time"

	"github.com/emersion/go-sasl"
	gosmtp "github.com/emersion/go-smtp"
)

type SMTPConfig struct {
	Host     string
	Port     int
	StartTLS bool
}

func (c SMTPConfig) Address() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

type EmailMessage struct {
	From       string
	To         []string
	Cc         []string
	Bcc        []string
	Subject    string
	Body       string
	IsHTML     bool
	InReplyTo  string
	References []string
}

func BuildMessage(msg EmailMessage) ([]byte, error) {
	var buf bytes.Buffer

	buf.WriteString(fmt.Sprintf("From: %s\r\n", msg.From))
	buf.WriteString(fmt.Sprintf("To: %s\r\n", strings.Join(msg.To, ", ")))

	if len(msg.Cc) > 0 {
		buf.WriteString(fmt.Sprintf("Cc: %s\r\n", strings.Join(msg.Cc, ", ")))
	}

	buf.WriteString(fmt.Sprintf("Subject: %s\r\n", msg.Subject))
	buf.WriteString(fmt.Sprintf("Date: %s\r\n", time.Now().Format(time.RFC1123Z)))
	buf.WriteString(fmt.Sprintf("Message-ID: <%s>\r\n", generateMessageID(msg.From)))

	if msg.InReplyTo != "" {
		buf.WriteString(fmt.Sprintf("In-Reply-To: %s\r\n", msg.InReplyTo))
	}
	if len(msg.References) > 0 {
		buf.WriteString(fmt.Sprintf("References: %s\r\n", strings.Join(msg.References, " ")))
	}

	buf.WriteString("MIME-Version: 1.0\r\n")

	if msg.IsHTML {
		buf.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	} else {
		buf.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	}

	buf.WriteString("\r\n")
	buf.WriteString(msg.Body)

	return buf.Bytes(), nil
}

func Send(cfg SMTPConfig, email, password string, msg EmailMessage) error {
	raw, err := BuildMessage(msg)
	if err != nil {
		return fmt.Errorf("build message: %w", err)
	}

	auth := smtp.PlainAuth("", email, password, cfg.Host)
	recipients := append(append(msg.To, msg.Cc...), msg.Bcc...)

	if cfg.StartTLS {
		return sendWithStartTLS(cfg, email, password, recipients, raw)
	}

	return smtp.SendMail(cfg.Address(), auth, msg.From, recipients, raw)
}

func sendWithStartTLS(cfg SMTPConfig, email, password string, recipients []string, raw []byte) error {
	c, err := gosmtp.DialStartTLS(cfg.Address(), &tls.Config{ServerName: cfg.Host})
	if err != nil {
		return fmt.Errorf("dial SMTP STARTTLS: %w", err)
	}
	defer c.Close()

	if err := c.Auth(sasl.NewPlainClient("", email, password)); err != nil {
		return fmt.Errorf("SMTP auth: %w", err)
	}

	if err := c.Mail(email, nil); err != nil {
		return fmt.Errorf("SMTP MAIL: %w", err)
	}

	for _, rcpt := range recipients {
		if err := c.Rcpt(rcpt, nil); err != nil {
			return fmt.Errorf("SMTP RCPT %s: %w", rcpt, err)
		}
	}

	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("SMTP DATA: %w", err)
	}

	if _, err := w.Write(raw); err != nil {
		return fmt.Errorf("write message: %w", err)
	}

	if err := w.Close(); err != nil {
		return fmt.Errorf("close data: %w", err)
	}

	return c.Quit()
}

func generateMessageID(from string) string {
	parts := strings.SplitN(from, "@", 2)
	domain := "localhost"
	if len(parts) == 2 {
		domain = parts[1]
	}
	return fmt.Sprintf("%d.%s@%s", time.Now().UnixNano(), parts[0], domain)
}
