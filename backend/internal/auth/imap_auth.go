package auth

import (
	"crypto/tls"
	"fmt"

	"github.com/emersion/go-imap/client"
)

type IMAPAuthConfig struct {
	Host string
	Port int
	TLS  bool
}

func (c IMAPAuthConfig) Address() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

func AuthenticateIMAP(cfg IMAPAuthConfig, email, password string) error {
	var c *client.Client
	var err error

	if cfg.TLS {
		c, err = client.DialTLS(cfg.Address(), &tls.Config{})
	} else {
		c, err = client.Dial(cfg.Address())
	}
	if err != nil {
		return fmt.Errorf("connect to IMAP: %w", err)
	}
	defer c.Logout()

	if err := c.Login(email, password); err != nil {
		return fmt.Errorf("IMAP login failed: %w", err)
	}

	return nil
}
