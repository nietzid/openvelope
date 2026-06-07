package models

import "time"

type CachedMessage struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Email     string    `gorm:"index;not null" json:"email"`
	Folder    string    `gorm:"index;not null" json:"folder"`
	UID       uint32    `gorm:"not null" json:"uid"`
	MessageID string    `gorm:"index" json:"message_id"`
	From      string    `json:"from"`
	To        string    `json:"to"`
	Subject   string    `json:"subject"`
	Date      time.Time `gorm:"index" json:"date"`
	Size      uint32    `json:"size"`
	Flags     string    `gorm:"type:jsonb" json:"flags"`
	HasAttach bool      `json:"has_attach"`
	Preview   string    `gorm:"type:text" json:"preview"`
	SearchVec string    `gorm:"type:tsvector" json:"-"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CompositeIndex and UniqueIndex are added via raw migration in SyncFolder
// because GORM AutoMigrate doesn't support composite indexes well.
// Composite index: (email, folder, date DESC)
// Unique index: (email, folder, uid)
