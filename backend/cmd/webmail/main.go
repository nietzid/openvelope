package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/arfiansyah/webmail/internal/api"
	"github.com/arfiansyah/webmail/internal/config"
	"github.com/arfiansyah/webmail/internal/imap"
	"github.com/arfiansyah/webmail/internal/models"
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
		ReadTimeout:  30,
		WriteTimeout: 30,
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

	api.RegisterRoutes(app, cfg, authHandler, folderHandler, messageHandler, composeHandler, searchHandler)

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
