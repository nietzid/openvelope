package models

import "time"

// SmtpSettings stores per-user SMTP relay configuration.
type SmtpSettings struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Email         string    `gorm:"uniqueIndex;not null" json:"email"`
	RelayHost     string    `json:"relay_host"`
	RelayPort     int       `json:"relay_port"`
	RelayUsername string    `json:"relay_username"`
	RelayPassword string    `json:"-"` // encrypted, never exposed directly
	RelayAuth     string    `json:"relay_auth"` // "plain", "login", "none"
	Enabled       bool      `json:"enabled"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
