package models

import "time"

type ContactGroup struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"not null" json:"name"`
	Email     string    `gorm:"index;not null" json:"email"` // owner user email
	Members   []Contact `gorm:"many2many:contact_group_members;" json:"members"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
