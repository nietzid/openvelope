# IMAP/SMTP Setup

Openvelope works with any standard IMAP/SMTP mail server. This guide covers common configurations.

## General Settings

### IMAP

| Protocol | Port | Encryption |
|----------|------|------------|
| IMAPS | 993 | TLS |
| IMAP (STARTTLS) | 143 | STARTTLS |

Openvelope requires IMAP for reading mail and folder management. IMAP IDLE is used for real-time push notifications when available.

### SMTP

| Protocol | Port | Encryption |
|----------|------|------------|
| SMTPS | 465 | TLS |
| Submission | 587 | STARTTLS |
| SMTP | 25 | Plain (usually blocked) |

Openvelope uses SMTP for sending mail. Port 587 with STARTTLS is recommended.

## Common Providers

### iRedMail

```yaml
auth:
  imap:
    host: mail.yourdomain.com
    port: 993
    tls: true
  smtp:
    host: mail.yourdomain.com
    port: 587
    starttls: true
```

### Mail-in-a-Box

```yaml
auth:
  imap:
    host: box.yourdomain.com
    port: 993
    tls: true
  smtp:
    host: box.yourdomain.com
    port: 587
    starttls: true
```

### Modoboa

```yaml
auth:
  imap:
    host: mail.yourdomain.com
    port: 993
    tls: true
  smtp:
    host: mail.yourdomain.com
    port: 587
    starttls: true
```

### Gmail

```yaml
auth:
  imap:
    host: imap.gmail.com
    port: 993
    tls: true
  smtp:
    host: smtp.gmail.com
    port: 587
    starttls: true
```

**Note:** Gmail requires an [App Password](https://support.google.com/accounts/answer/185833) if you have 2FA enabled.

### Outlook / Office 365

```yaml
auth:
  imap:
    host: outlook.office365.com
    port: 993
    tls: true
  smtp:
    host: smtp.office365.com
    port: 587
    starttls: true
```

## Global SMTP Relay

If you want all outgoing mail to go through a single SMTP server (instead of using each user's credentials), configure the `smtp_relay` section:

```yaml
smtp_relay:
  enabled: true
  host: mail.example.com
  port: 587
  username: relay@example.com
  password: your-password
  auth: plain
```

When relay mode is enabled:
- Users compose and send email normally
- All mail is sent through the relay server
- The "From" address uses the user's configured identity
- The relay must be configured to allow sending from your domain

## Troubleshooting

### Connection Refused
- Verify the hostname and port are correct
- Check firewall rules on the mail server
- Ensure the mail server is running

### Authentication Failed
- Verify the email address and password are correct
- Check if an App Password is required (Gmail, Outlook)
- Ensure the account has IMAP access enabled

### TLS Errors
- Some servers use self-signed certificates
- Ensure the correct port is used (993 for TLS, 143 for STARTTLS)
- Check if the server requires STARTTLS vs direct TLS

### IMAP IDLE Not Working
- Not all IMAP servers support IDLE
- Openvelope falls back to polling if IDLE is unavailable
- This is normal and doesn't affect functionality
