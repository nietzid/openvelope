# Installation

## Prerequisites

- A mail server with IMAP and SMTP access (iRedMail, Mail-in-a-Box, Modoboa, or any standard mail server)
- PostgreSQL 16+
- Optional: Docker and Docker Compose

## Option 1: Docker Compose (Recommended)

```bash
git clone https://github.com/arfiansyah/openvelope.git
cd openvelope

# Configure your mail server
cp config.yaml config.local.yaml
# Edit config.local.yaml with your database and mail server settings

# Start everything
docker compose up -d
```

Open http://localhost:8080 and sign in with your email credentials.

## Option 2: Build from Source

### Prerequisites

- Go 1.26+
- Node.js 22+
- PostgreSQL 16+

### Steps

```bash
git clone https://github.com/arfiansyah/openvelope.git
cd openvelope

# Build the backend
cd backend
cp config.yaml config.local.yaml
# Edit config.local.yaml with your settings
go mod download
go build -o openvelope ./cmd/openvelope

# Build the frontend
cd ../frontend
npm install
npm run build
cd ..

# The backend embeds the frontend dist — run it anywhere
./backend/openvelope --config backend/config.local.yaml
```

## Option 3: Development Mode

```bash
# Terminal 1 — Backend
cd backend
cp config.yaml config.local.yaml
go run ./cmd/openvelope --config config.local.yaml

# Terminal 2 — Frontend (hot reload)
cd frontend
npm install
npm run dev
```

The frontend dev server runs on port 5173 and proxies API requests to the backend on port 8080.

## Verify Installation

1. Open http://localhost:8080 (or http://localhost:5173 in dev mode)
2. Sign in with your email address and password
3. Your mailbox should load automatically
