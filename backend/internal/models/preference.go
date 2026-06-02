package models

import "time"

type UserPreference struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Email       string    `gorm:"uniqueIndex;not null" json:"email"`
	Theme       string    `gorm:"default:'light'" json:"theme"`
	Language    string    `gorm:"default:'en'" json:"language"`
	PageSize    int       `gorm:"default:50" json:"page_size"`
	SortOrder   string    `gorm:"default:'date_desc'" json:"sort_order"`
	ComposeHTML bool      `gorm:"default:true" json:"compose_html"`
	Timezone    string    `gorm:"default:'UTC'" json:"timezone"`
	DateFormat  string    `gorm:"default:'YYYY-MM-DD'" json:"date_format"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
