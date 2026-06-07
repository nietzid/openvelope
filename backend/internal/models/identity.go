package models

import "time"

type Identity struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Email       string    `gorm:"index;not null" json:"email"`
	Name        string    `gorm:"not null" json:"name"`
	FromEmail   string    `gorm:"not null" json:"from_email"`
	ReplyTo     string    `json:"reply_to"`
	IsDefault   bool      `gorm:"default:false" json:"is_default"`
	SignatureID *uint     `json:"signature_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Signature struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Email     string    `gorm:"index;not null" json:"email"`
	Name      string    `gorm:"not null" json:"name"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	IsDefault bool      `gorm:"default:false" json:"is_default"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
