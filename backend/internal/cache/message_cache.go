package cache

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/arfiansyah/openvelope/internal/imap"
	"github.com/arfiansyah/openvelope/internal/models"
	"gorm.io/gorm"
)

type MessageCache struct {
	db *gorm.DB
}

func NewMessageCache(db *gorm.DB) *MessageCache {
	return &MessageCache{db: db}
}

// EnsureIndexes creates composite and unique indexes that GORM AutoMigrate
// cannot express. It uses raw SQL so it's safe to call repeatedly.
func (mc *MessageCache) EnsureIndexes() error {
	// Unique index on (email, folder, uid)
	if err := mc.db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_cached_messages_email_folder_uid
		ON cached_messages (email, folder, uid)
	`).Error; err != nil {
		return fmt.Errorf("create unique index: %w", err)
	}

	// Composite index on (email, folder, date DESC) for efficient listing
	if err := mc.db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_cached_messages_email_folder_date
		ON cached_messages (email, folder, date DESC)
	`).Error; err != nil {
		return fmt.Errorf("create composite index: %w", err)
	}

	// GIN index for full-text search
	if err := mc.db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_cached_messages_search_vec
		ON cached_messages USING GIN (search_vec)
	`).Error; err != nil {
		return fmt.Errorf("create GIN index: %w", err)
	}

	return nil
}

// SyncFolder fetches all message metadata from IMAP and upserts into the cache.
func (mc *MessageCache) SyncFolder(email, folder string, conn *imap.UserConnection) error {
	// Fetch all messages from IMAP (page 0, large page size to get everything)
	// We use a loop to get all messages
	var allMessages []imap.MessageSummary
	page := 0
	pageSize := 500

	for {
		messages, _, err := imap.ListMessages(conn, folder, page, pageSize)
		if err != nil {
			return fmt.Errorf("list messages: %w", err)
		}
		allMessages = append(allMessages, messages...)
		if len(messages) < pageSize {
			break
		}
		page++
	}

	// Upsert each message
	for _, msg := range allMessages {
		if err := mc.UpsertMessage(email, folder, &msg); err != nil {
			return fmt.Errorf("upsert message uid %d: %w", msg.UID, err)
		}
	}

	return nil
}

// GetCachedMessages reads from cache with pagination.
func (mc *MessageCache) GetCachedMessages(email, folder string, page, pageSize int) ([]models.CachedMessage, int64, error) {
	var total int64
	if err := mc.db.Model(&models.CachedMessage{}).
		Where("email = ? AND folder = ?", email, folder).
		Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count cached messages: %w", err)
	}

	var messages []models.CachedMessage
	if err := mc.db.Where("email = ? AND folder = ?", email, folder).
		Order("date DESC, uid DESC").
		Offset(page * pageSize).
		Limit(pageSize).
		Find(&messages).Error; err != nil {
		return nil, 0, fmt.Errorf("get cached messages: %w", err)
	}

	return messages, total, nil
}

// UpdateCacheOnEvent handles real-time IMAP events to keep cache in sync.
func (mc *MessageCache) UpdateCacheOnEvent(email, eventType, folder string, uid uint32, conn *imap.UserConnection) error {
	switch eventType {
	case "new_message":
		// Fetch metadata from IMAP and insert
		_, total, err := imap.ListMessages(conn, folder, 0, 500)
		if err != nil {
			return fmt.Errorf("fetch new message: %w", err)
		}
		// If the total is 0, there's nothing to cache
		if total == 0 {
			return nil
		}
		// Fetch all messages to find the one with matching UID
		messages, _, err := imap.ListMessages(conn, folder, 0, 500)
		if err != nil {
			return fmt.Errorf("fetch messages: %w", err)
		}
		for i := range messages {
			if messages[i].UID == uid {
				return mc.UpsertMessage(email, folder, &messages[i])
			}
		}
	case "flags_changed":
		// Fetch all to get updated flags (no single-UID fetch available)
		messages, _, err := imap.ListMessages(conn, folder, 0, 500)
		if err != nil {
			return fmt.Errorf("fetch messages for flags: %w", err)
		}
		for i := range messages {
			if messages[i].UID == uid {
				return mc.UpsertMessage(email, folder, &messages[i])
			}
		}
	case "message_deleted":
		// Delete from cache
		return mc.db.Where("email = ? AND folder = ? AND uid = ?", email, folder, uid).
			Delete(&models.CachedMessage{}).Error
	}

	return nil
}

// UpsertMessage inserts or updates a cached message by (email, folder, uid).
func (mc *MessageCache) UpsertMessage(email, folder string, msg *imap.MessageSummary) error {
	flagsJSON, err := json.Marshal(msg.Flags)
	if err != nil {
		return fmt.Errorf("marshal flags: %w", err)
	}

	cached := models.CachedMessage{
		Email:     email,
		Folder:    folder,
		UID:       msg.UID,
		From:      msg.From,
		To:        msg.To,
		Subject:   msg.Subject,
		Date:      msg.Date,
		Size:      msg.Size,
		Flags:     string(flagsJSON),
		HasAttach: msg.HasAttach,
		Preview:   msg.Preview,
	}

	// Upsert: insert on conflict, update on (email, folder, uid)
	result := mc.db.Where("email = ? AND folder = ? AND uid = ?", email, folder, msg.UID).
		Assign(models.CachedMessage{
			From:      msg.From,
			To:        msg.To,
			Subject:   msg.Subject,
			Date:      msg.Date,
			Size:      msg.Size,
			Flags:     string(flagsJSON),
			HasAttach: msg.HasAttach,
			Preview:   msg.Preview,
		}).
		FirstOrCreate(&cached)

	return result.Error
}

// SearchCached performs a full-text search on the cached messages.
func (mc *MessageCache) SearchCached(email, folder, text, from, to string, dateAfter, dateBefore *time.Time, hasAttachment bool, page, pageSize int) ([]models.CachedMessage, int64, error) {
	query := mc.db.Where("email = ?", email)

	if folder != "" {
		query = query.Where("folder = ?", folder)
	}

	if text != "" {
		// Use plainto_tsquery to safely handle user input (no special character escaping needed)
		query = query.Where("search_vec @@ plainto_tsquery('english', ?)", text)
	}

	if from != "" {
		query = query.Where("from ILIKE ?", "%"+from+"%")
	}

	if to != "" {
		query = query.Where("to ILIKE ?", "%"+to+"%")
	}

	if dateAfter != nil {
		query = query.Where("date >= ?", *dateAfter)
	}

	if dateBefore != nil {
		query = query.Where("date <= ?", *dateBefore)
	}

	if hasAttachment {
		query = query.Where("has_attach = true")
	}

	var total int64
	if err := query.Model(&models.CachedMessage{}).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("count search results: %w", err)
	}

	var messages []models.CachedMessage
	if err := query.Order("date DESC, uid DESC").
		Offset(page * pageSize).
		Limit(pageSize).
		Find(&messages).Error; err != nil {
		return nil, 0, fmt.Errorf("search cached: %w", err)
	}

	return messages, total, nil
}
