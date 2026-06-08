# syntax=docker/dockerfile:1

FROM node:22-alpine AS frontend-builder
WORKDIR /src/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM golang:1.26-alpine AS backend-builder
WORKDIR /src/backend

RUN apk add --no-cache ca-certificates

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
COPY --from=frontend-builder /src/frontend/dist ./internal/web/dist

RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/openvelope ./cmd/openvelope

FROM alpine:3.22
WORKDIR /app

RUN apk add --no-cache ca-certificates \
  && addgroup -S openvelope \
  && adduser -S -G openvelope openvelope \
  && mkdir -p /etc/openvelope \
  && chown -R openvelope:openvelope /app /etc/openvelope

COPY --from=backend-builder /out/openvelope /app/openvelope
COPY backend/config.yaml /etc/openvelope/config.yaml

ENV OPENVELOPE_CONFIG=/etc/openvelope/config.yaml
EXPOSE 8080

USER openvelope
ENTRYPOINT ["/app/openvelope"]
