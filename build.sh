#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"
WEB_DIST_DIR="$BACKEND_DIR/internal/web/dist"

echo "Building frontend..."
(
  cd "$FRONTEND_DIR"
  npm run build
)

echo "Copying frontend dist to backend/internal/web..."
rm -rf "$WEB_DIST_DIR"
mkdir -p "$WEB_DIST_DIR"
cp -R "$FRONTEND_DIR/dist/." "$WEB_DIST_DIR/"

echo "Building backend..."
(
  cd "$BACKEND_DIR"
  go build -o webmail ./cmd/webmail
  mv webmail "$ROOT_DIR"
)

echo "Build complete: $ROOT_DIR/webmail"
