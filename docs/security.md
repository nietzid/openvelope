# Security Guide

This document covers security best practices for deploying and running Openvelope.

## Deployment Security

### HTTPS

Always use HTTPS in production. Run Openvelope behind a reverse proxy with TLS termination (see [reverse-proxy.md](reverse-proxy.md)).

### Secrets Management

1. **Never use default secrets in production** — change `jwt_secret` and `encryption_key` in your config
2. Use environment variables or a secret manager instead of hardcoded config values
3. Generate strong random secrets:
   ```bash
   openssl rand -hex 32  # For encryption_key (32 bytes = 64 hex chars)
   openssl rand -base64 32  # For jwt_secret
   ```

### Database

- Use a strong, unique password for the PostgreSQL user
- Restrict database access to the application server only
- Use `sslmode: require` or `sslmode: verify-full` for database connections over the network
- Run regular backups

### Network

- Run Openvelope behind a reverse proxy
- Bind the application to `127.0.0.1` when using a reverse proxy on the same machine
- Use a firewall to restrict access to port 8080
- Enable rate limiting at the reverse proxy level

## Application Security

### Authentication

- Session tokens use JWT with configurable expiration
- Access tokens have a short TTL (default: 15 minutes)
- Refresh tokens allow seamless re-authentication
- Password-based authentication against your IMAP server
- Rate limiting is applied to login attempts

### Email Security

Openvelope applies strict sanitization to HTML email:

- Strips dangerous elements: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<link>`
- Removes all inline event handlers (`onclick`, `onload`, etc.)
- Blocks `javascript:` and `data:` URIs in `href` and `src`
- Preserves safe HTML for legitimate email rendering

### Session Management

- Sessions are stored in PostgreSQL with the user's email
- Session tokens are cryptographically random
- Sessions can be invalidated server-side
- Logout clears the session from the database

### CSRF Protection

- Anti-CSRF tokens are validated on state-changing requests
- CORS is configured to allow only trusted origins
- SameSite cookie attributes are set appropriately

## Reporting Vulnerabilities

See [SECURITY.md](../SECURITY.md) for our vulnerability disclosure policy.

## Checklist

- [ ] HTTPS enabled via reverse proxy
- [ ] Default secrets changed (`jwt_secret`, `encryption_key`)
- [ ] Strong database password configured
- [ ] Database access restricted to application server
- [ ] Rate limiting configured on login endpoint
- [ ] Firewall restricts access to necessary ports only
- [ ] Regular backups configured
- [ ] Dependencies are scanned for vulnerabilities
- [ ] Logging does not include email content or passwords
- [ ] File upload size limits are set
