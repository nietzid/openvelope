package api

import (
	"errors"
	"strconv"

	"github.com/arfiansyah/webmail/internal/models"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

type ContactsHandler struct {
	db *gorm.DB
}

func NewContactsHandler(db *gorm.DB) *ContactsHandler {
	return &ContactsHandler{db: db}
}

func (h *ContactsHandler) List(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	page, _ := strconv.Atoi(c.Query("page", "0"))
	pageSize, _ := strconv.Atoi(c.Query("page_size", "50"))
	q := c.Query("q", "")

	if page < 0 {
		page = 0
	}
	if pageSize <= 0 || pageSize > 200 {
		pageSize = 50
	}

	query := h.db.Where("email = ?", email)
	if q != "" {
		like := "%" + q + "%"
		query = query.Where("display_name ILIKE ? OR email_addr ILIKE ?", like, like)
	}

	var total int64
	if err := query.Model(&models.Contact{}).Count(&total).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to count contacts"},
		})
	}

	var contacts []models.Contact
	if err := query.Order("display_name ASC").Offset(page * pageSize).Limit(pageSize).Find(&contacts).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to list contacts"},
		})
	}

	return c.JSON(fiber.Map{
		"contacts":  contacts,
		"page":      page,
		"page_size": pageSize,
		"total":     total,
	})
}

func (h *ContactsHandler) Create(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	var contact models.Contact
	if err := c.Bind().JSON(&contact); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	if contact.DisplayName == "" || contact.EmailAddr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "display_name and email_addr are required"},
		})
	}

	contact.Email = email

	if err := h.db.Create(&contact).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to create contact"},
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"contact": contact})
}

func (h *ContactsHandler) Update(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid contact id"},
		})
	}

	var existing models.Contact
	if err := h.db.Where("id = ? AND email = ?", id, email).First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": fiber.Map{"code": "NOT_FOUND", "message": "contact not found"},
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to find contact"},
		})
	}

	var updates models.Contact
	if err := c.Bind().JSON(&updates); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	// Preserve ownership
	updates.Email = email

	if err := h.db.Model(&existing).Updates(updates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to update contact"},
		})
	}

	return c.JSON(fiber.Map{"contact": existing})
}

func (h *ContactsHandler) Delete(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid contact id"},
		})
	}

	result := h.db.Where("id = ? AND email = ?", id, email).Delete(&models.Contact{})
	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to delete contact"},
		})
	}
	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": fiber.Map{"code": "NOT_FOUND", "message": "contact not found"},
		})
	}

	return c.JSON(fiber.Map{"ok": true})
}

type autocompleteResult struct {
	ID          uint   `json:"id"`
	DisplayName string `json:"display_name"`
	EmailAddr   string `json:"email_addr"`
}

func (h *ContactsHandler) Autocomplete(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	q := c.Query("q", "")
	if q == "" {
		return c.JSON(fiber.Map{"results": []autocompleteResult{}})
	}

	like := "%" + q + "%"
	var results []autocompleteResult
	if err := h.db.Where("email = ?", email).
		Where("display_name ILIKE ? OR email_addr ILIKE ?", like, like).
		Select("id, display_name, email_addr").
		Order("display_name ASC").
		Limit(10).
		Find(&results).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to search contacts"},
		})
	}

	return c.JSON(fiber.Map{"results": results})
}
