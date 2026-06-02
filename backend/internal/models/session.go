package models

import "time"

type Session struct {
	ID             string    `gorm:"primaryKey;type:uuid" json:"id"`
	Email          string    `gorm:"index;not null" json:"email"`
	RefreshToken   string    `gorm:"uniqueIndex;not null" json:"-"`
	EncryptedCreds string    `gorm:"type:text;not null" json:"-"`
	UserAgent      string    `json:"user_agent"`
	IPAddress      string    `json:"ip_address"`
	ExpiresAt      time.Time `gorm:"index" json:"expires_at"`
	CreatedAt      time.Time `json:"created_at"`
}
