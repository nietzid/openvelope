package api

import (
	"errors"
	"strconv"

	"github.com/arfiansyah/webmail/internal/models"
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"
)

type ContactGroupsHandler struct {
	db *gorm.DB
}

func NewContactGroupsHandler(db *gorm.DB) *ContactGroupsHandler {
	return &ContactGroupsHandler{db: db}
}

func (h *ContactGroupsHandler) List(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	var groups []models.ContactGroup
	if err := h.db.Where("email = ?", email).Preload("Members").Order("name ASC").Find(&groups).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to list groups"},
		})
	}

	return c.JSON(fiber.Map{"groups": groups})
}

type createGroupRequest struct {
	Name      string `json:"name"`
	MemberIDs []uint `json:"member_ids"`
}

func (h *ContactGroupsHandler) Create(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	var req createGroupRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "name is required"},
		})
	}

	// Fetch members that belong to the user
	var members []models.Contact
	if len(req.MemberIDs) > 0 {
		if err := h.db.Where("id IN ? AND email = ?", req.MemberIDs, email).Find(&members).Error; err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": fiber.Map{"code": "DB_ERROR", "message": "failed to fetch members"},
			})
		}
	}

	group := models.ContactGroup{
		Name:    req.Name,
		Email:   email,
		Members: members,
	}

	if err := h.db.Create(&group).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to create group"},
		})
	}

	// Reload with members
	h.db.Preload("Members").First(&group, group.ID)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"group": group})
}

type updateGroupRequest struct {
	Name      *string `json:"name"`
	MemberIDs *[]uint `json:"member_ids"`
}

func (h *ContactGroupsHandler) Update(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid group id"},
		})
	}

	var group models.ContactGroup
	if err := h.db.Where("id = ? AND email = ?", id, email).First(&group).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": fiber.Map{"code": "NOT_FOUND", "message": "group not found"},
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to find group"},
		})
	}

	var req updateGroupRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid request body"},
		})
	}

	if req.Name != nil {
		if *req.Name == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": fiber.Map{"code": "BAD_REQUEST", "message": "name cannot be empty"},
			})
		}
		group.Name = *req.Name
		h.db.Model(&group).Update("name", group.Name)
	}

	if req.MemberIDs != nil {
		var members []models.Contact
		if len(*req.MemberIDs) > 0 {
			if err := h.db.Where("id IN ? AND email = ?", *req.MemberIDs, email).Find(&members).Error; err != nil {
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error": fiber.Map{"code": "DB_ERROR", "message": "failed to fetch members"},
				})
			}
		}
		// Replace association
		if err := h.db.Model(&group).Association("Members").Replace(members); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": fiber.Map{"code": "DB_ERROR", "message": "failed to update members"},
			})
		}
	}

	// Reload with members
	h.db.Preload("Members").First(&group, group.ID)

	return c.JSON(fiber.Map{"group": group})
}

func (h *ContactGroupsHandler) Delete(c fiber.Ctx) error {
	email, ok := c.Locals("email").(string)
	if !ok || email == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": fiber.Map{"code": "UNAUTHORIZED", "message": "no email in context"},
		})
	}

	id, err := strconv.ParseUint(c.Params("id"), 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": fiber.Map{"code": "BAD_REQUEST", "message": "invalid group id"},
		})
	}

	var group models.ContactGroup
	if err := h.db.Where("id = ? AND email = ?", id, email).First(&group).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": fiber.Map{"code": "NOT_FOUND", "message": "group not found"},
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to find group"},
		})
	}

	// Clear associations first
	h.db.Model(&group).Association("Members").Clear()

	if err := h.db.Delete(&group).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fiber.Map{"code": "DB_ERROR", "message": "failed to delete group"},
		})
	}

	return c.JSON(fiber.Map{"ok": true})
}
