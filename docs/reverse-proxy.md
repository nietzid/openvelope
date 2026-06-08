# Reverse Proxy Setup

For production deployments, you should run Openvelope behind a reverse proxy for TLS termination, HTTPS, and better security.

## Nginx

```nginx
server {
    listen 443 ssl;
    server_name mail.example.com;

    ssl_certificate /etc/ssl/certs/mail.example.com.pem;
    ssl_certificate_key /etc/ssl/private/mail.example.com.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_read_timeout 86400s;
    }

    # Increase max body size for email attachments
    client_max_body_size 50M;
}

server {
    listen 80;
    server_name mail.example.com;
    return 301 https://$server_name$request_uri;
}
```

## Caddy

```
mail.example.com {
    reverse_proxy 127.0.0.1:8080 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Caddy handles TLS automatically
}
```

## Apache

```apache
<VirtualHost *:443>
    ServerName mail.example.com

    SSLEngine on
    SSLCertificateFile /etc/ssl/certs/mail.example.com.pem
    SSLCertificateKeyFile /etc/ssl/private/mail.example.com.key

    # Security headers
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set X-XSS-Protection "1; mode=block"

    # WebSocket proxy
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/ws(.*)$ ws://127.0.0.1:8080/ws$1 [P,L]

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:8080/
    ProxyPassReverse / http://127.0.0.1:8080/

    # Increase max body size
    LimitRequestBody 52428800
</VirtualHost>
```

## WebSocket Support

Openvelope uses WebSocket for real-time email notifications. Ensure your reverse proxy is configured to:

1. Pass the `Upgrade` and `Connection` headers
2. Set a long `proxy_read_timeout` (86400s = 24h) for WebSocket connections
3. Route `/ws` paths to the Openvelope backend

## Security Notes

- Always use HTTPS in production
- Set strong `jwt_secret` and `encryption_key` in your Openvelope config
- Restrict access to port 8080 to localhost only when using a reverse proxy
- Enable rate limiting at the reverse proxy level for login endpoints
