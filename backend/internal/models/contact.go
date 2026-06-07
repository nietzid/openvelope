package models

import "time"

type Contact struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Email       string    `gorm:"index;not null" json:"email"`
	DisplayName string    `gorm:"not null" json:"display_name"`
	FirstName   string    `json:"first_name"`
	LastName    string    `json:"last_name"`
	EmailAddr   string    `gorm:"not null" json:"email_addr"`
	Phone       string    `json:"phone"`
	Company     string    `json:"company"`
	Notes       string    `gorm:"type:text" json:"notes"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
