# Openvelope

**A simple, open-source webmail built for developers, communities, and self-hosters.**

Openvelope is a drop-in webmail replacement that works with any standard IMAP/SMTP mail server (iRedMail, Mail-in-a-Box, Modoboa, etc.). Single Go binary with an embedded React SPA — deploy and go.

## Philosophy

> **Openvelope is not trying to be the biggest webmail. It is trying to be the easiest webmail to understand, modify, and self-host.**

### Goals

- Simple codebase — understand the whole project in minutes
- Easy to customize — theme system, configuration over code
- Plugin-friendly architecture
- Self-hostable — one binary, Docker Compose, any IMAP/SMTP server
- Clean, modern webmail UI
- IMAP/SMTP first — no vendor lock-in

### Non-goals

- Becoming a full groupware suite
- Competing with Gmail feature-by-feature
- Adding complexity before stability

## Quick Start

### Using Docker Compose

```bash
git clone https://github.com/arfiansyah/openvelope.git
cd openvelope
cp .env.example .env
# Edit .env with your IMAP/SMTP settings
docker compose up -d
```

Open http://localhost:8080 and sign in with your email credentials.

### Building from source

Requirements: Go 1.26+, Node.js 22+

```bash
# Build everything
./build.sh

# Or build manually
cd frontend && npm run build
cd ../backend && go build -o openvelope ./cmd/openvelope

# Configure and run
cp .env.example .env
./openvelope --config config.yaml
```

## Configuration

Openvelope is configured via a YAML config file (default: `config.yaml`). See [docs/configuration.md](docs/configuration.md) for all options.

Key environment variables:

| Variable | Description |
|----------|-------------|
| `OPENVELOPE_CONFIG` | Path to config file (default: `config.yaml`) |
| `DATABASE_URL` | PostgreSQL connection string |

## Architecture

```
backend/           # Go backend (Fiber v3 + GORM + PostgreSQL)
  cmd/openvelope/  # Entry point
  internal/
    api/           # REST + WebSocket handlers
    config/        # YAML configuration
    imap/          # IMAP connection management
    smtp/          # SMTP client
    models/        # Database models
    web/           # Embedded frontend dist
    ws/            # WebSocket hub
    middleware/    # Auth middleware
    cache/        # Message cache

frontend/          # React SPA (Vite + TypeScript + Tailwind)
  src/
    app/           # Routes and app shell
    components/    # UI components (primitives, layout, mail, search)
    hooks/         # React hooks
    lib/           # Utilities (format, sanitize, motion)
    services/      # API clients
    stores/        # Zustand state management
    styles/        # Design tokens and Tailwind
    types/         # TypeScript types
```

## Features

- [x] IMAP mailbox listing and folder navigation
- [x] Read, send, reply, forward email
- [x] HTML email with sanitization
- [x] Attachment support (send and receive)
- [x] Search across folders
- [x] Real-time push via WebSocket + IMAP IDLE
- [x] Multiple identities/signatures
- [x] Contact management
- [x] Dark/light theme
- [x] Keyboard shortcuts
- [x] Responsive layout (desktop + mobile)
- [x] Conversation threading

## Roadmap

### v0.1
- Login with IMAP/SMTP
- Mailbox listing
- Message reading and sending
- Search
- Attachments

### v0.2 (current)
- Contact management
- Multiple identities
- Dark/light themes
- Keyboard shortcuts
- Conversation threading

### v0.3
- Plugin API
- Admin configuration UI
- Docker Compose deployment
- Performance optimizations

### v1.0
- Stable API
- Security audit
- Migration guide
- Production-ready documentation

## Security

Email handles sensitive data. See [SECURITY.md](SECURITY.md) for our security policy and [docs/security.md](docs/security.md) for deployment security best practices.

## License

Apache-2.0 — see [LICENSE](LICENSE).
