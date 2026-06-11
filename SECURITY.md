# SECURITY.md

Security review checklist for backend work.
Run the relevant sections before shipping any feature that touches auth, data, payments,
uploads, admin access, external callbacks, or account management.

This is not a one-time setup checklist. Run it per-feature, per-change.

---

## How to Use This File

1. Identify which sections apply to the current change.
2. Work through each item in those sections.
3. Mark `[x]` for passed, `[!]` for failed/at-risk, `[-]` for not applicable.
4. For any `[!]` item — do not ship until it is resolved or explicitly accepted with a documented reason.
5. Paste the completed relevant sections into the CHANGELOG entry under Verification.

---

## Section Index

- [A] Authentication
- [B] Authorization & Access Control
- [C] Input Validation & Output Safety
- [D] Password & Credential Handling
- [E] Session & Token Management
- [F] API Security
- [G] Data Integrity & Database Safety
- [H] File Upload & Storage
- [I] Payment & Billing
- [J] Webhooks & External Callbacks
- [K] Secret & Key Management
- [L] Audit Logging
- [M] Rate Limiting & Abuse Protection
- [N] Email & Notification Security
- [O] Admin & Privileged Access
- [P] Dependency & Supply Chain
- [Q] Error Handling & Information Leakage
- [R] Infrastructure & Deployment

---

## Project-Specific Notes

- Dependency audit command: `bun audit`.
- Current dependency audit status: passing as of 2026-06-08.
- `package.json` uses an `overrides` pin for `brace-expansion@5.0.6` to keep transitive lint tooling on the patched version.
- TanStack Start was updated after audit flagged an older `@tanstack/start-server-core` advisory.
- Turso credentials are read from `TURSO_DB_URL` and `TURSO_DB_TOKEN` in local `.env`; `.env` is ignored and `.env.example` must contain placeholders only.
- Current Turso integration includes tenant registration/login, scrypt password hashes, Turso-backed sessions, tenant-scoped catalog/backoffice reads and writes, tenant settings persistence and runtime tax/service application, product variants, product/category/customer/supplier/outlet/promotion edits, customer/supplier/promotion deletes, outlet soft-delete, expense/user creation, cashier checkout persistence, shift open/close persistence, inventory stock adjustments, import/export audit logging, product CSV import/upsert, stock CSV import, stock-transfer request records, purchase order drafts/status updates, purchase order item receiving into product stock, device pairing requests/logout, and idempotent additive schema setup.
- Role enforcement uses shared helpers in `src/lib/auth.ts`: `owner` has full access, `manager` has operational/backoffice access except user management, `kasir` is limited to cashier/customer/promo workflows, `gudang` is limited to catalog/inventory/purchasing/import-export workflows, and `display` is limited to customer display. Route guards and selected sensitive server mutations enforce these rules.
- CSV import accepts only client-provided text content through authenticated server functions, caps payloads at about 5 MB, derives tenant ownership server-side, and records success/failure summaries in `audit_logs`. It does not yet provide preview approval, per-row error reports, malware scanning, or object storage.
- Product SKU uniqueness is tenant-scoped through `(tenant_id, sku)`. Do not enforce global SKU uniqueness across tenants because that leaks cross-tenant existence and blocks legitimate duplicate merchant SKU systems.
- Cashier checkout totals are recomputed server-side from tenant-owned products and tenant tax/service settings before transaction persistence; client-supplied subtotal, tax, service charge, and total are rejected when they do not match.
- Rate limiting is implemented in-memory via `src/lib/rate-limit.ts`: dual-key login limiting (5/IP/15min, 10/email/15min), account lockout (10 failures → 15min lock), registration rate limiting (3/IP/5min), and password reset rate limiting (3/IP/5min). Multi-instance deployments need shared state (Redis) for production.
- Security headers middleware in `src/start.ts` adds X-Content-Type-Options, X-Frame-Options, Referrer-Policy, X-XSS-Protection, Permissions-Policy, and HSTS (production only).
- Password reset flow uses SHA-256 hashed tokens with 1-hour expiry, rate limiting, and session invalidation on reset. Tokens are displayed in-app; email delivery is deferred.
- PIN-based cashier login (`loginWithPin`) accepts 6-digit PINs stored as scrypt hashes in `app_users.pin_hash`. PIN login is optional; empty `kasirPin` means disabled.
- Session cleanup runs hourly to remove expired sessions from the database.
- CSRF protection uses a double-submit cookie pattern (`SameSite=Strict`) via `src/lib/csrf.ts`. The cookie is set in `src/server.ts` and validated in state-mutating server functions.
- MFA is not implemented.
- Business reads and writes must derive `tenant_id` from the authenticated session server-side. Do not accept tenant ownership from client input.

---

## [A] Authentication

- [ ] Login endpoint does not reveal whether email exists (use identical error messages)
- [ ] Login is rate limited — brute force is not possible
- [ ] Failed login attempts are logged with IP and timestamp
- [ ] MFA support exists or is explicitly out of scope with documented reason
- [ ] Account lockout or exponential backoff implemented after N failed attempts
- [ ] Password-based auth uses a slow hash function (bcrypt, argon2, scrypt)
- [ ] Auth tokens are not logged in plain text anywhere
- [ ] OAuth/SSO flows validate `state` parameter to prevent CSRF
- [ ] OAuth/SSO flows validate `redirect_uri` against a strict allowlist
- [ ] Auth endpoints return consistent response times (no timing oracle)

---

## [B] Authorization & Access Control

- [ ] Every route/endpoint has explicit authorization — no route relies on "security by obscurity"
- [ ] Authorization is enforced server-side — never trust client-supplied role or permission claims
- [ ] Resource ownership is verified before any read, update, or delete operation
- [ ] Horizontal privilege escalation is not possible (user A cannot access user B's data)
- [ ] Vertical privilege escalation is not possible (user cannot self-assign elevated roles)
- [ ] Admin-only routes are protected by role check — not just by "not linking to them"
- [ ] Multi-tenant data is strictly isolated — cross-tenant data leakage is not possible
- [ ] Soft-deleted or inactive records are excluded from normal queries
- [ ] Permission checks happen at the data layer, not only at the route layer

---

## [C] Input Validation & Output Safety

- [ ] All user input is validated server-side — client-side validation is UX only
- [ ] Input validation uses an allowlist approach (define what is valid, reject everything else)
- [ ] String lengths are bounded — no unbounded text fields accepted
- [ ] Numeric ranges are validated — no negative quantities, no out-of-range values
- [ ] File types are validated by content (magic bytes), not just by extension or MIME header
- [ ] JSON input is validated against a schema before use
- [ ] SQL queries use parameterized statements or a safe ORM — no raw string interpolation
- [ ] HTML output is escaped — user-supplied content cannot inject scripts (XSS)
- [ ] `Content-Type` headers are set correctly on all responses
- [ ] `X-Content-Type-Options: nosniff` header present
- [ ] Redirect destinations are validated against an allowlist — open redirect is not possible
- [ ] Path traversal is not possible in file operations (e.g., `../../etc/passwd`)

---

## [D] Password & Credential Handling

- [ ] Passwords are hashed with bcrypt (cost ≥ 12), argon2id, or scrypt — never MD5/SHA1/SHA256 alone
- [ ] Password reset tokens are cryptographically random (≥ 32 bytes), not predictable
- [ ] Password reset tokens expire (recommend: 15–60 minutes)
- [ ] Password reset tokens are single-use — invalidated immediately after use
- [ ] Password reset does not reveal whether the email is registered
- [ ] Old password is required to change password (not just a reset token)
- [ ] Password reset flow invalidates all existing sessions after reset
- [ ] Password history check prevents immediate reuse (if policy requires)
- [ ] Temporary passwords / magic links are single-use and short-lived
- [ ] Credentials are never logged, even partially

---

## [E] Session & Token Management

- [ ] Session tokens are cryptographically random and not guessable
- [ ] Session tokens are rotated after privilege change (login, role change, password reset)
- [ ] Sessions are invalidated on logout — not just cleared on the client
- [ ] Session expiry is enforced server-side — not just by cookie TTL
- [ ] JWT signatures are verified on every request — `alg: none` is rejected
- [ ] JWT expiry (`exp`) is enforced
- [ ] JWT audience (`aud`) and issuer (`iss`) are validated
- [ ] Refresh tokens are rotated on use (rotation + invalidation of old token)
- [ ] Refresh token reuse is detected and treated as a breach signal
- [ ] Session cookies have `HttpOnly`, `Secure`, and `SameSite=Lax` or `Strict` attributes
- [ ] Tokens are not stored in `localStorage` (use `HttpOnly` cookies or memory)
- [ ] Concurrent session limits are defined and enforced (if policy requires)

---

## [F] API Security

- [ ] All API endpoints require authentication unless explicitly public
- [ ] Public endpoints are explicitly documented and reviewed
- [ ] CORS origin is set to an explicit allowlist — `*` is not used in production
- [ ] CORS allows only required methods and headers
- [ ] HTTP methods are enforced — GET endpoints do not accept POST and vice versa
- [ ] API versioning strategy is defined — old versions are not silently deprecated
- [ ] GraphQL (if used): introspection disabled in production, query depth limited
- [ ] GraphQL (if used): query cost analysis or complexity limits implemented
- [ ] Batch endpoints validate that all requested items belong to the requesting user
- [ ] Response payloads do not include fields the user is not authorized to see
- [ ] Sensitive fields (passwords, tokens, secrets) are never returned in API responses

---

## [G] Data Integrity & Database Safety

- [ ] Write operations are wrapped in transactions where atomicity is required
- [ ] Concurrent writes are handled safely — no race conditions on critical counters or balances
- [ ] Idempotency keys used for operations that must not be duplicated (payments, emails)
- [ ] Migrations are tested on a copy of production data before running in production
- [ ] Migrations have a rollback path (down migration) tested and verified
- [ ] No migration drops a column or table without a deprecation period
- [ ] Bulk operations (delete, update) have a row-count sanity check before execution
- [ ] Soft delete is used for user-owned records — hard delete is not the default
- [ ] Database backups are tested — not just scheduled but actually restored and verified
- [ ] Connection pool limits are configured — unbounded connections are not possible

---

## [H] File Upload & Storage

- [ ] File type is validated by content (magic bytes) — not by extension or Content-Type header
- [ ] File size limit is enforced server-side
- [ ] Uploaded files are stored outside the web root or in object storage — not publicly served directly
- [ ] Uploaded filenames are sanitized or replaced entirely — user-supplied names are not trusted
- [ ] Uploaded files are scanned for malware (if required by risk level)
- [ ] Executable file types are blocked (.sh, .exe, .php, .py, .js, .html, etc.)
- [ ] SVG uploads are treated as untrusted HTML — sanitized or not rendered inline
- [ ] Signed URLs with expiry are used for private file access
- [ ] Object storage bucket is not publicly readable by default
- [ ] Upload metadata (original filename, uploader, timestamp) is logged

---

## [I] Payment & Billing

- [ ] Payment amounts are calculated server-side — never trust client-supplied price
- [ ] Coupon/discount logic is validated server-side — not applied on client
- [ ] Currency and amount are validated before passing to payment provider
- [ ] Idempotency keys are used for all charge/capture operations
- [ ] Payment provider webhooks are verified by signature before processing
- [ ] Duplicate webhook events are handled idempotently
- [ ] Failed payments are logged with enough context for support
- [ ] Refund logic requires an explicit authorization check
- [ ] Free trial abuse (multiple accounts) is considered and mitigated if applicable
- [ ] PCI scope is understood — card data never touches your servers if using tokenization

---

## [J] Webhooks & External Callbacks

- [ ] Webhook signatures are verified using the provider's signing secret
- [ ] Raw request body is used for signature verification — parsed body is not
- [ ] Webhook events are processed idempotently — duplicate delivery is safe
- [ ] Webhook handler responds `2xx` before processing (to avoid timeout retries causing side effects)
- [ ] Webhook source IP is validated if provider publishes a fixed IP range
- [ ] Webhook payload is validated against expected schema before acting on it
- [ ] Replay attacks are mitigated by checking event timestamp freshness
- [ ] Failed webhook processing is logged with the full event payload for retry

---

## [K] Secret & Key Management

- [ ] No secrets in source code, comments, or commit history
- [ ] No secrets in environment variable names that appear in logs or error messages
- [ ] `.env` files are in `.gitignore` — verified in current repo
- [ ] Secrets are stored in a secrets manager or encrypted vault (not plaintext in a DB column)
- [ ] API keys and secrets are scoped to minimum required permissions
- [ ] Secrets rotation process exists and is documented
- [ ] Leaked secret response plan exists: revoke → rotate → audit → notify
- [ ] Service accounts and API keys are per-environment (staging keys ≠ production keys)
- [ ] Internal service-to-service calls use signed tokens, not hardcoded shared secrets

---

## [L] Audit Logging

- [ ] Auth events are logged: login, logout, failed login, password reset, MFA change
- [ ] Privilege changes are logged: role assignment, permission grant/revoke
- [ ] Sensitive data access is logged: PII export, admin data view, bulk queries
- [ ] Destructive operations are logged: delete, bulk update, account deactivation
- [ ] Payment events are logged: charge, refund, dispute, subscription change
- [ ] Logs include: timestamp, user ID, IP address, action, affected resource ID
- [ ] Logs are append-only — users and non-admin services cannot modify or delete logs
- [ ] Log retention period is defined and compliant with applicable regulations
- [ ] Logs do not contain passwords, tokens, or full payment card numbers

---

## [M] Rate Limiting & Abuse Protection

- [ ] Auth endpoints are rate limited by IP and by account
- [ ] Password reset endpoint is rate limited
- [ ] Account creation is rate limited to prevent mass registration
- [ ] API endpoints have per-user rate limits
- [ ] Search and list endpoints have pagination limits — unbounded result sets not possible
- [ ] Email sending is rate limited per user and per domain
- [ ] File upload endpoint is rate limited
- [ ] Rate limit responses use `429 Too Many Requests` with `Retry-After` header
- [ ] Rate limit state is stored server-side — not client-supplied

---

## [N] Email & Notification Security

- [ ] Unsubscribe links use signed tokens — not guessable user IDs
- [ ] Email verification tokens are single-use and expire
- [ ] Notification content does not include sensitive data in plain text (e.g., full card number)
- [ ] Outbound email uses SPF, DKIM, and DMARC
- [ ] Email sender address is fixed and not user-configurable without validation
- [ ] HTML emails sanitize any user-supplied content before rendering

---

## [O] Admin & Privileged Access

- [ ] Admin panel is on a separate route with explicit role check
- [ ] Admin actions require re-authentication for destructive operations
- [ ] Admin impersonation (acting as another user) is logged with the admin's identity
- [ ] Admin-only APIs are not accessible by regular user tokens — tested explicitly
- [ ] Admin access is MFA-required (or documented exception with reason)
- [ ] Admin account enumeration is not possible from admin login endpoint errors
- [ ] Inactive admin accounts are disabled or removed

---

## [P] Dependency & Supply Chain

- [ ] Dependencies are pinned to exact versions in production
- [ ] `npm audit` / `pip-audit` / equivalent run and findings reviewed
- [ ] No packages with known critical CVEs in use
- [ ] No packages abandoned for 2+ years in critical paths
- [ ] Lock file (`package-lock.json`, `yarn.lock`, `poetry.lock`) is committed
- [ ] CI pipeline fails on high/critical vulnerability findings
- [ ] Internal packages and private registries use auth — no accidental public fallback

---

## [Q] Error Handling & Information Leakage

- [ ] Stack traces are never returned to the client in production
- [ ] Database errors are caught and returned as generic messages — no schema leakage
- [ ] 404 and 403 responses are indistinguishable for private resources (no oracle)
- [ ] Error responses use a consistent structure — no ad-hoc error formats
- [ ] Server version headers are removed (`X-Powered-By`, `Server`)
- [ ] Debug mode / verbose logging is disabled in production
- [ ] Source maps are not publicly accessible in production

---

## [R] Infrastructure & Deployment

- [ ] Production environment variables are managed in a secrets manager — not in CI plain text
- [ ] Staging environment does not have access to production data or secrets
- [ ] Firewall / security group allows only required ports and sources
- [ ] Database is not publicly accessible — only reachable from app servers
- [ ] SSH access is key-based only — password auth disabled
- [ ] Principle of least privilege applied to all service roles and IAM policies
- [ ] Dependency updates are automated (Dependabot / Renovate) and reviewed
- [ ] Container images are scanned for vulnerabilities before deployment
- [ ] TLS 1.2+ enforced — TLS 1.0 and 1.1 disabled
- [ ] HTTPS redirect enforced — HTTP is not served in production
- [ ] HSTS header set with appropriate `max-age`

---

## Sign-Off

> Complete this section when submitting a security review for a significant feature.

**Feature reviewed:** [description]
**Reviewed by:** [agent session / developer name]
**Date:** [YYYY-MM-DD]
**Sections run:** [list sections checked]
**Failed items `[!]`:** [list or "none"]
**Accepted risks (with reason):** [list or "none"]
**Recommended follow-up:** [list or "none"]
