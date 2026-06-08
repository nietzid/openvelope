# Contributing to Openvelope

Thank you for considering contributing to Openvelope! This document outlines the process for contributing to the project.

## Code of Conduct

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Run Locally

### Prerequisites

- Go 1.26+
- Node.js 22+
- PostgreSQL 16+
- An IMAP/SMTP-enabled email account

### Setup

```bash
git clone https://github.com/arfiansyah/openvelope.git
cd openvelope

# Backend
cd backend
cp config.yaml config.local.yaml
# Edit config.local.yaml with your database and mail server settings
go mod download
go run ./cmd/openvelope --config config.local.yaml

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

### Running Tests

**Backend:**
```bash
cd backend
go test ./...
```

**Frontend:**
```bash
cd frontend
npm test
```

For property-based tests:
```bash
cd frontend
npx vitest --run src/__tests__/properties/
```

## Branch Naming

- `feat/<description>` — new features
- `fix/<description>` — bug fixes
- `docs/<description>` — documentation changes
- `refactor/<description>` — code refactoring
- `chore/<description>` — maintenance tasks

## Pull Request Rules

1. **One change per PR** — keep PRs focused on a single concern
2. **Tests required** — new features and bug fixes must include tests
3. **All tests pass** — verify with `go test ./...` and `npm test` before submitting
4. **No unrelated changes** — formatting or style changes belong in their own PR
5. **Descriptive title and description** — explain what and why, not just how
6. **Small PRs are better** — prefer several small PRs over one large one

## Coding Style

### Go

- Follow standard `gofmt` conventions
- Error handling: always check errors, use early returns
- Package naming: lowercase, single word when possible
- Use `internal/` for private packages

### TypeScript / React

- TypeScript strict mode — avoid `any`
- Functional components with hooks — no class components
- Zustand for global state, React state for local state
- Tailwind CSS for styling — no CSS modules or styled-components
- Follow existing patterns in the codebase

## How to Propose Features

Before implementing a large feature, open an issue first to discuss:

1. What problem does it solve?
2. How does it fit the project's philosophy?
3. What's the proposed implementation approach?

We may reject features that:
- Add significant complexity for niche use cases
- Diverge from the project's core mission
- Duplicate functionality better suited as a plugin

## What We Will Reject

- Changes that break existing functionality without migration path
- Large dependency additions without clear justification
- UI changes that don't respect the existing design system
- Features that compromise security or privacy
- Changes that make self-hosting significantly harder

## Project Structure

```
backend/
  cmd/openvelope/       # Entry point
  internal/
    api/                # REST + WebSocket handlers
    config/             # YAML configuration
    imap/               # IMAP connection management
    smtp/               # SMTP client
    models/             # Database models
    web/                # Embedded frontend
    ws/                 # WebSocket hub
    middleware/         # Auth middleware
    cache/              # Message cache

frontend/
  src/
    app/                # Routes and app shell
    components/         # UI components
    hooks/              # React hooks
    lib/                # Utilities
    services/           # API clients
    stores/             # Zustand stores
    styles/             # Design tokens
    types/              # TypeScript types
```

## Getting Help

- Open a GitHub Discussion for questions
- Open a GitHub Issue for bug reports and feature requests
- For security issues, see [SECURITY.md](SECURITY.md)
