package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server    ServerConfig    `yaml:"server"`
	Database  DatabaseConfig  `yaml:"database"`
	Auth      AuthConfig      `yaml:"auth"`
	Session   SessionConfig   `yaml:"session"`
	SMTPRelay SMTPRelayConfig `yaml:"smtp_relay"`
}

// SMTPRelayConfig defines a global SMTP relay that can be used instead of per-user IMAP credentials.
type SMTPRelayConfig struct {
	Enabled  bool   `yaml:"enabled"`
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Username string `yaml:"username"`
	Password string `yaml:"password"`
	Auth     string `yaml:"auth"` // "plain", "login", "none"
}

type ServerConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
}

type DatabaseConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	DBName   string `yaml:"dbname"`
	SSLMode  string `yaml:"sslmode"`
	URL      string `yaml:"url"`
}

func (d DatabaseConfig) DSN() string {
	if d.URL != "" {
		return d.URL
	}
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.DBName, d.SSLMode,
	)
}

type AuthConfig struct {
	IMAP IMAPConfig `yaml:"imap"`
	SMTP SMTPConfig `yaml:"smtp"`
}

type IMAPConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
	TLS  bool   `yaml:"tls"`
}

type SMTPConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	StartTLS bool   `yaml:"starttls"`
	// Relay configuration (optional — when set, uses these credentials for SMTP instead of IMAP credentials)
	RelayUsername string `yaml:"relay_username"`
	RelayPassword string `yaml:"relay_password"`
	RelayFrom     string `yaml:"relay_from"`
	RelayAuth     string `yaml:"relay_auth"` // "plain", "login", or empty for auto
}

type SessionConfig struct {
	JWTSecret       string   `yaml:"jwt_secret"`
	AccessTokenTTL  Duration `yaml:"access_token_ttl"`
	RefreshTokenTTL Duration `yaml:"refresh_token_ttl"`
	EncryptionKey   string   `yaml:"encryption_key"`
}

type Duration struct {
	time.Duration
}

func (d *Duration) UnmarshalYAML(value *yaml.Node) error {
	var err error
	d.Duration, err = time.ParseDuration(value.Value)
	return err
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	if err := applyEnvOverrides(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func applyEnvOverrides(cfg *Config) error {
	setString("WEBMAIL_SERVER_HOST", &cfg.Server.Host)
	if err := setInt("WEBMAIL_SERVER_PORT", &cfg.Server.Port); err != nil {
		return err
	}

	setString("DATABASE_URL", &cfg.Database.URL)
	setString("WEBMAIL_DATABASE_URL", &cfg.Database.URL)
	setString("WEBMAIL_DATABASE_HOST", &cfg.Database.Host)
	if err := setInt("WEBMAIL_DATABASE_PORT", &cfg.Database.Port); err != nil {
		return err
	}
	setString("WEBMAIL_DATABASE_USER", &cfg.Database.User)
	setString("WEBMAIL_DATABASE_PASSWORD", &cfg.Database.Password)
	setString("WEBMAIL_DATABASE_DBNAME", &cfg.Database.DBName)
	setString("WEBMAIL_DATABASE_SSLMODE", &cfg.Database.SSLMode)

	setString("WEBMAIL_IMAP_HOST", &cfg.Auth.IMAP.Host)
	if err := setInt("WEBMAIL_IMAP_PORT", &cfg.Auth.IMAP.Port); err != nil {
		return err
	}
	if err := setBool("WEBMAIL_IMAP_TLS", &cfg.Auth.IMAP.TLS); err != nil {
		return err
	}

	setString("WEBMAIL_SMTP_HOST", &cfg.Auth.SMTP.Host)
	if err := setInt("WEBMAIL_SMTP_PORT", &cfg.Auth.SMTP.Port); err != nil {
		return err
	}
	if err := setBool("WEBMAIL_SMTP_STARTTLS", &cfg.Auth.SMTP.StartTLS); err != nil {
		return err
	}
	setString("WEBMAIL_SMTP_AUTH_RELAY_USERNAME", &cfg.Auth.SMTP.RelayUsername)
	setString("WEBMAIL_SMTP_AUTH_RELAY_PASSWORD", &cfg.Auth.SMTP.RelayPassword)
	setString("WEBMAIL_SMTP_AUTH_RELAY_FROM", &cfg.Auth.SMTP.RelayFrom)
	setString("WEBMAIL_SMTP_AUTH_RELAY_AUTH", &cfg.Auth.SMTP.RelayAuth)

	setString("WEBMAIL_SESSION_JWT_SECRET", &cfg.Session.JWTSecret)
	if err := setDuration("WEBMAIL_SESSION_ACCESS_TOKEN_TTL", &cfg.Session.AccessTokenTTL); err != nil {
		return err
	}
	if err := setDuration("WEBMAIL_SESSION_REFRESH_TOKEN_TTL", &cfg.Session.RefreshTokenTTL); err != nil {
		return err
	}
	setString("WEBMAIL_SESSION_ENCRYPTION_KEY", &cfg.Session.EncryptionKey)

	if err := setBool("WEBMAIL_SMTP_RELAY_ENABLED", &cfg.SMTPRelay.Enabled); err != nil {
		return err
	}
	setString("WEBMAIL_SMTP_RELAY_HOST", &cfg.SMTPRelay.Host)
	if err := setInt("WEBMAIL_SMTP_RELAY_PORT", &cfg.SMTPRelay.Port); err != nil {
		return err
	}
	setString("WEBMAIL_SMTP_RELAY_USER", &cfg.SMTPRelay.Username)
	setString("WEBMAIL_SMTP_RELAY_USERNAME", &cfg.SMTPRelay.Username)
	setString("WEBMAIL_SMTP_RELAY_PASSWORD", &cfg.SMTPRelay.Password)
	setString("WEBMAIL_SMTP_RELAY_AUTH", &cfg.SMTPRelay.Auth)

	return nil
}

func setString(name string, target *string) {
	if value, ok := os.LookupEnv(name); ok {
		*target = value
	}
}

func setInt(name string, target *int) error {
	value, ok := os.LookupEnv(name)
	if !ok {
		return nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fmt.Errorf("parse %s: %w", name, err)
	}
	*target = parsed
	return nil
}

func setBool(name string, target *bool) error {
	value, ok := os.LookupEnv(name)
	if !ok {
		return nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fmt.Errorf("parse %s: %w", name, err)
	}
	*target = parsed
	return nil
}

func setDuration(name string, target *Duration) error {
	value, ok := os.LookupEnv(name)
	if !ok {
		return nil
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fmt.Errorf("parse %s: %w", name, err)
	}
	target.Duration = parsed
	return nil
}
