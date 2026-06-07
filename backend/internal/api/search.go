package api

import (
	"errors"
	"strconv"
	"time"

	"github.com/arfiansyah/webmail/internal/auth"
	"github.com/arfiansyah/webmail/internal/cache"
	"github.com/arfiansyah/webmail/internal/config"
	"github.com/arfiansyah/webmail/internal/imap"
	"github.com/arfiansyah/webmail/internal/models"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

type SearchHandler struct {
	db      *gorm.DB
	cfg     *config.Config
	manager *imap.Manager
	cache   *cache.MessageCache
}

func NewSearchHandler(db *gorm.DB, cfg *config.Config, manager *imap.Manager, mc *cache.MessageCache) *SearchHandler {
	return &SearchHandler{db: db, cfg: cfg, manager: manager, cache: mc}
}

func (h *SearchHandler) getUserConnection(c fiber.Ctx) (*imap.UserConnection, error) {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return nil, errors.New("no email in context")
	}

	var session models.Session
	if err := h.db.Where("email = ?", email).Order("created_at DESC").First(&session).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("no active session")
		}
		return nil, err
	}

	password, err := auth.Decrypt(session.EncryptedCreds, h.cfg.Session.EncryptionKey)
	if err != nil {
		return nil, err
	}

	return h.manager.GetOrCreate(email, password)
}

func (h *SearchHandler) Search(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	folder := c.Query("folder", "INBOX")
	text := c.Query("text")
	from := c.Query("from")
	to := c.Query("to")
	dateAfter := c.Query("date_after")
	dateBefore := c.Query("date_before")
	hasAttachment := c.Query("has_attachment") == "true"
	page, _ := strconv.Atoi(c.Query("page", "0"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "50"))

	if page < 0 {
		page = 0
	}
	if pageSize <= 0 || pageSize > 200 {
		pageSize = 50
	}

	// Parse date filters
	var sinceDate *time.Time
	var beforeDate *time.Time
	if dateAfter != "" {
		if t, err := time.Parse("2006-01-02", dateAfter); err == nil {
			sinceDate = &t
		}
	}
	if dateBefore != "" {
		if t, err := time.Parse("2006-01-02", dateBefore); err == nil {
			beforeDate = &t
		}
	}

	// Try cache-based search first
	if h.cache != nil {
		var count int64
		h.db.Model(&models.CachedMessage{}).
			Where("email = ? AND folder = ?", email, folder).
			Count(&count)

		if count > 0 {
			// Use cache-based full-text search
			messages, total, err := h.cache.SearchCached(email, folder, text, from, to, sinceDate, beforeDate, hasAttachment, page, pageSize)
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": fiber.Map{"code": "DB_ERROR", "message": "search failed"},
				})
			}

			return c.JSON(fiber.Map{
				"results":   messages,
				"count":     len(messages),
				"total":     total,
				"page":      page,
				"page_size": pageSize,
				"source":    "cache",
			})
		}
	}

	// Fall back to IMAP search
	conn, err := h.getUserConnection(c)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	query := imap.SearchQuery{
		Text:    text,
		From:    from,
		To:      to,
		Since:   sinceDate,
		Before:  beforeDate,
	}

	results, err := imap.SearchMessages(conn, folder, query)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "IMAP_FAILED", "message": err.Error()},
		})
	}

	// Post-filter for attachment search when not using cache
	if hasAttachment && h.cache != nil {
		var filtered []models.CachedMessage
		uidList := make([]uint32, len(results))
		for i, r := range results {
			uidList[i] = r.UID
		}
		// Use cache DB to check has_attach
		h.db.Where("email = ? AND folder = ? AND uid IN ? AND has_attach = true", email, folder, uidList).Find(&filtered)
		attachUIDs := make(map[uint32]bool, len(filtered))
		for _, m := range filtered {
			attachUIDs[m.UID] = true
		}
		var filteredResults []imap.MessageSummary
		for _, r := range results {
			if attachUIDs[r.UID] {
				filteredResults = append(filteredResults, r)
			}
		}
		results = filteredResults
	}

	return c.JSON(fiber.Map{
		"results":   results,
		"count":     len(results),
		"page":      page,
		"page_size": pageSize,
		"source":    "imap",
	})
}
