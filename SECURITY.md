# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

Openvelope handles private email, attachments, sessions, and credentials. Security is a top priority.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report them privately by email to the project maintainer. You can find the contact information in the commit history or by opening a GitHub issue asking for a secure contact method.

When reporting, please include:

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Any potential impact

You should receive a response within 48 hours. If you don't, follow up to ensure we received your report.

## Security Practices

### For Users

- Keep your deployment updated to the latest version
- Use HTTPS behind a reverse proxy (see [docs/reverse-proxy.md](docs/reverse-proxy.md))
- Set strong `jwt_secret` and `encryption_key` in your config
- Use environment variables or a secret manager for sensitive configuration
- Restrict database access to the application only

### For Contributors

- No logging of email content, passwords, tokens, or message bodies
- All HTML email is sanitized before rendering — never render raw HTML
- Session tokens are HTTP-only and use secure, random values
- Rate limiting is applied to login and SMTP actions
- Dependencies are scanned for vulnerabilities with each build
- CSRF protection is enforced on all state-changing endpoints
- Secrets are never hardcoded — use environment variables or config files

### HTML Email Security

HTML email rendering is one of the biggest security surfaces in any webmail application. Openvelope:

- Strips `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`, `<link>` elements
- Strips all inline event handler attributes (`on*`)
- Strips `javascript:` and `data:` URI schemes from `href` and `src`
- Preserves safe HTML structure for legitimate email content

## Dependencies

We scan dependencies for known vulnerabilities as part of our build process.
If you discover a vulnerable dependency, please report it via the process above.
