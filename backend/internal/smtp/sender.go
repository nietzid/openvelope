package smtp

import (
	"bytes"
	"crypto/tls"
	"encoding/base64"
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
	// Relay configuration (optional)
	RelayEnabled  bool
	RelayUsername string
	RelayPassword string
	RelayFrom     string
	RelayAuth     string // "plain", "login", "none", or empty for auto (plain)
}

// IsRelay returns true if relay is enabled and credentials are configured.
func (c SMTPConfig) IsRelay() bool {
	return c.RelayEnabled && c.RelayUsername != ""
}

// IsNoAuth returns true if the relay uses no authentication.
func (c SMTPConfig) IsNoAuth() bool {
	return c.RelayEnabled && strings.ToLower(c.RelayAuth) == "none"
}

// AuthCredentials returns the username and password to use for SMTP authentication.
// If relay is configured, relay credentials are used; otherwise, the user's own credentials.
func (c SMTPConfig) AuthCredentials(email, password string) (authUser, authPass string) {
	if c.IsRelay() {
		return c.RelayUsername, c.RelayPassword
	}
	return email, password
}

// SenderAddress returns the envelope sender (MAIL FROM) address.
// If relay_from is configured, it is used; otherwise, the user's email is used.
func (c SMTPConfig) SenderAddress(email string) string {
	if c.RelayFrom != "" {
		return c.RelayFrom
	}
	return email
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

// Attachment represents an email attachment with raw bytes.
type Attachment struct {
	Filename    string
	ContentType string
	Content     []byte
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

// BuildMessageWithAttachments builds a multipart/mixed MIME message with attachments.
func BuildMessageWithAttachments(msg EmailMessage, attachments []Attachment) ([]byte, error) {
	if len(attachments) == 0 {
		return BuildMessage(msg)
	}

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

	boundary := fmt.Sprintf("_=_boundary_%d_=_", time.Now().UnixNano())
	buf.WriteString("MIME-Version: 1.0\r\n")
	buf.WriteString(fmt.Sprintf("Content-Type: multipart/mixed; boundary=%q\r\n", boundary))
	buf.WriteString("\r\n")

	// Body part
	buf.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	if msg.IsHTML {
		buf.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	} else {
		buf.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	}
	buf.WriteString("\r\n")
	buf.WriteString(msg.Body)
	buf.WriteString("\r\n")

	// Attachment parts
	for _, att := range attachments {
		buf.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		buf.WriteString(fmt.Sprintf("Content-Type: %s\r\n", att.ContentType))
		buf.WriteString(fmt.Sprintf("Content-Disposition: attachment; filename=%q\r\n", att.Filename))
		buf.WriteString("Content-Transfer-Encoding: base64\r\n")
		buf.WriteString("\r\n")
		buf.WriteString(insertLineBreaks(base64.StdEncoding.EncodeToString(att.Content)))
		buf.WriteString("\r\n")
	}

	buf.WriteString(fmt.Sprintf("--%s--\r\n", boundary))
	return buf.Bytes(), nil
}

func insertLineBreaks(s string) string {
	var buf bytes.Buffer
	for i, c := range s {
		buf.WriteRune(c)
		if (i+1)%76 == 0 {
			buf.WriteString("\r\n")
		}
	}
	return buf.String()
}

func Send(cfg SMTPConfig, email, password string, msg EmailMessage) error {
	raw, err := BuildMessage(msg)
	if err != nil {
		return fmt.Errorf("build message: %w", err)
	}

	return SendRaw(cfg, email, password, msg, raw)
}

func SendRaw(cfg SMTPConfig, email, password string, msg EmailMessage, raw []byte) error {
	authUser, authPass := cfg.AuthCredentials(email, password)
	sender := cfg.SenderAddress(email)
	recipients := append(append(msg.To, msg.Cc...), msg.Bcc...)

	if cfg.StartTLS {
		return sendWithStartTLS(cfg, authUser, authPass, sender, recipients, raw)
	}

	if cfg.IsNoAuth() {
		return smtp.SendMail(cfg.Address(), nil, sender, recipients, raw)
	}

	auth := smtp.PlainAuth("", authUser, authPass, cfg.Host)
	return smtp.SendMail(cfg.Address(), auth, sender, recipients, raw)
}

// SendWithAttachments sends an email with attachments via SMTP.
func SendWithAttachments(cfg SMTPConfig, email, password string, msg EmailMessage, attachments []Attachment) error {
	raw, err := BuildMessageWithAttachments(msg, attachments)
	if err != nil {
		return fmt.Errorf("build message: %w", err)
	}

	return SendRaw(cfg, email, password, msg, raw)
}

func sendWithStartTLS(cfg SMTPConfig, authUser, authPass, sender string, recipients []string, raw []byte) error {
	c, err := gosmtp.DialStartTLS(cfg.Address(), &tls.Config{ServerName: cfg.Host})
	if err != nil {
		return fmt.Errorf("dial SMTP STARTTLS: %w", err)
	}
	defer c.Close()

	// Skip auth if relay_auth is "none"
	if !cfg.IsNoAuth() {
		// Choose SASL mechanism based on relay_auth config
		var saslClient sasl.Client
		switch strings.ToLower(cfg.RelayAuth) {
		case "login":
			saslClient = sasl.NewLoginClient(authUser, authPass)
		default:
			// "plain" or empty — use PLAIN auth
			saslClient = sasl.NewPlainClient("", authUser, authPass)
		}

		if err := c.Auth(saslClient); err != nil {
			return fmt.Errorf("SMTP auth: %w", err)
		}
	}

	if err := c.Mail(sender, nil); err != nil {
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
