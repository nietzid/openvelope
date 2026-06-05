package main

import (
	"flag"
	"io/fs"
	"log"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/arfiansyah/webmail/internal/api"
	"github.com/arfiansyah/webmail/internal/config"
	"github.com/arfiansyah/webmail/internal/imap"
	"github.com/arfiansyah/webmail/internal/models"
	"github.com/arfiansyah/webmail/internal/web"
	"github.com/arfiansyah/webmail/internal/ws"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
)

func main() {
	configPath := flag.String("config", "config.yaml", "path to config file")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	db, err := models.InitDB(cfg.Database.DSN())
	if err != nil {
		log.Fatalf("init database: %v", err)
	}

	manager := imap.NewManager(imap.IMAPConfig{
		Host: cfg.Auth.IMAP.Host,
		Port: cfg.Auth.IMAP.Port,
		TLS:  cfg.Auth.IMAP.TLS,
	})

	hub := ws.NewHub()
	go hub.Run()

	authHandler := api.NewAuthHandler(db, cfg, manager)
	folderHandler := api.NewFolderHandler(db, cfg, manager)
	messageHandler := api.NewMessageHandler(db, cfg, manager)
	composeHandler := api.NewComposeHandler(db, cfg)
	searchHandler := api.NewSearchHandler(db, cfg, manager)

	app := fiber.New(fiber.Config{
		AppName:      "Webmail",
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
	}))

	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} ${method} ${path} (${latency})\n",
	}))

	api.RegisterRoutes(app, cfg, hub, manager, authHandler, folderHandler, messageHandler, composeHandler, searchHandler)

	mimeTypes := map[string]string{
		".html": "text/html; charset=utf-8",
		".js":   "application/javascript; charset=utf-8",
		".css":  "text/css; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".svg":  "image/svg+xml",
		".png":  "image/png",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".gif":  "image/gif",
		".ico":  "image/x-icon",
		".woff": "font/woff",
		".woff2": "font/woff2",
		".ttf":  "font/ttf",
		".map":  "application/json",
	}
	getContentType := func(path string) string {
		dot := strings.LastIndex(path, ".")
		if dot < 0 {
			return ""
		}
		return mimeTypes[path[dot:]]
	}

	// Serve embedded frontend (SPA with fallback to index.html)
	distFS, err := web.DistFS()
	if err != nil {
		log.Printf("warning: failed to load embedded frontend: %v", err)
	} else {
		app.Use(func(c fiber.Ctx) error {
			path := c.Path()
			// Skip API and WebSocket paths
			if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/ws") || path == "/health" {
				return c.Next()
			}
			// Try to serve the requested static file
			cleanPath := strings.TrimPrefix(path, "/")
			if cleanPath != "" {
				if data, readErr := fs.ReadFile(distFS, cleanPath); readErr == nil {
					contentType := getContentType(cleanPath)
					if contentType != "" {
						c.Set("Content-Type", contentType)
					}
					return c.Send(data)
				}
			}
			// Fall back to index.html for SPA routing
			indexHTML, readErr := fs.ReadFile(distFS, "index.html")
			if readErr != nil {
				return c.Status(500).SendString("Frontend not built")
			}
			c.Set("Content-Type", "text/html; charset=utf-8")
			return c.Send(indexHTML)
		})
	}

	go func() {
		addr := cfg.Server.Host + ":" + strconv.Itoa(cfg.Server.Port)
		log.Printf("listening on %s", addr)
		if err := app.Listen(addr); err != nil {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down...")
	manager.CloseAll()
	if err := app.Shutdown(); err != nil {
		log.Printf("shutdown error: %v", err)
	}
}
