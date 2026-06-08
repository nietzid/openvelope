# Configuration

Openvelope is configured via a YAML file. By default it reads `config.yaml` from the current directory, but you can override this with the `OPENVELOPE_CONFIG` environment variable.

## Reference

```yaml
server:
  host: "0.0.0.0"
  port: 8080

database:
  host: localhost
  port: 5432
  user: openvelope
  password: openvelope
  dbname: openvelope
  sslmode: disable

auth:
  imap:
    host: mail.example.com
    port: 993
    tls: true
  smtp:
    host: mail.example.com
    port: 587
    starttls: true

session:
  jwt_secret: "change-me-in-production"
  access_token_ttl: "15m"
  refresh_token_ttl: "168h"
  encryption_key: "0123456789abcdef0123456789abcdef"

smtp_relay:
  enabled: false
  host: ""
  port: 587
  username: ""
  password: ""
  auth: "plain"
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENVELOPE_CONFIG` | Path to config file | `config.yaml` |
| `DATABASE_URL` | Full PostgreSQL connection string (overrides `database.*` config) | — |

## Sections

### `server`

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `host` | string | Bind address | `"0.0.0.0"` |
| `port` | int | HTTP port | `8080` |

### `database`

| Field | Type | Description |
|-------|------|-------------|
| `host` | string | PostgreSQL host |
| `port` | int | PostgreSQL port |
| `user` | string | Database user |
| `password` | string | Database password |
| `dbname` | string | Database name |
| `sslmode` | string | SSL mode (`disable`, `require`, `verify-full`) |

### `auth`

#### `auth.imap`

| Field | Type | Description |
|-------|------|-------------|
| `host` | string | IMAP server hostname |
| `port` | int | IMAP server port (993 for TLS, 143 for plain) |
| `tls` | bool | Use TLS for IMAP connection |

#### `auth.smtp`

| Field | Type | Description |
|-------|------|-------------|
| `host` | string | SMTP server hostname |
| `port` | int | SMTP server port (587 for STARTTLS, 465 for TLS, 25 for plain) |
| `starttls` | bool | Use STARTTLS for SMTP |

### `session`

| Field | Type | Description |
|-------|------|-------------|
| `jwt_secret` | string | Secret key for JWT tokens (change in production!) |
| `access_token_ttl` | duration | Access token lifetime (e.g., `"15m"`, `"1h"`) |
| `refresh_token_ttl` | duration | Refresh token lifetime (e.g., `"168h"`) |
| `encryption_key` | string | Key for encrypting sensitive data (32 hex chars) |

### `smtp_relay`

Optional global SMTP relay for sending all outgoing mail through a single server instead of using each user's credentials.

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | bool | Enable relay mode |
| `host` | string | Relay SMTP host |
| `port` | int | Relay SMTP port |
| `username` | string | Relay authentication username |
| `password` | string | Relay authentication password |
| `auth` | string | Auth type: `"plain"`, `"login"`, or `"none"` |
