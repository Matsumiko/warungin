# DECISIONS.md

Accepted project decisions that future agents must not accidentally undo.

Use this for durable product, business, architecture, security, data, or UX decisions. Do not use it for task logs, temporary plans, or unresolved ideas.

## How To Add A Decision

```markdown
## Short Decision Title

Status: accepted
Date: 2026-06-05

Decision:
Describe the decision clearly.

Reason:
Explain why this direction was chosen.

Impact:

- List behavior, UI, API, data, testing, or documentation impact.

Review:
State when this decision may be revisited, or write "Only with explicit owner approval."
```

## Accepted Decisions

## Production Security Baseline

Status: accepted
Date: 2026-06-09

Decision:
Security hardening uses in-memory dual-key rate limiting (IP + email), account lockout (10 failures = 15min), security headers middleware, PIN-based cashier login with scrypt hashing, password reset via SHA-256 hashed tokens with 1-hour expiry, and hourly session cleanup.

Reason:
The app lacked critical production security controls. Rate limiting and lockout prevent brute-force attacks, security headers harden the HTTP surface, PIN login enables quick cashier access, password reset provides self-service recovery, and session cleanup prevents unbounded DB growth.

Impact:

- Rate limiting is in-memory; multi-instance deployments need shared state (Redis).
- CSRF hardening and MFA are not yet implemented.
- Password reset tokens are displayed in-app; email delivery is deferred.

Review:
Revisit when deploying multi-instance, adding email integration, or implementing CSRF/MFA.

## Role Access Is Enforced Centrally

Status: accepted
Date: 2026-06-09

Decision:
Warungin roles use shared access helpers in `src/lib/auth.ts` for route guards, role home redirects, sidebar filtering, and sensitive server mutations. `owner` has full access; `manager` manages operations except user management; `kasir` uses cashier/customer/promo workflows; `gudang` uses catalog/inventory/purchasing/import-export workflows; `display` only uses customer display.

Reason:
The app already persisted user roles, but routes and actions were effectively open to every authenticated user. Central rules reduce accidental drift between UI navigation and server behavior.

Impact:

- Login redirects users to the home route for their role.
- Sidebar/topbar actions hide unauthorized entries.
- Server mutations for settings, users, devices, audit logs, import/export, catalog writes, checkout, and shift operations must keep role checks aligned with the route map.

Review:
Only with explicit owner approval.

## Product SKU Is Tenant Scoped

Status: accepted
Date: 2026-06-09

Decision:
Product SKU uniqueness belongs to each tenant, not the whole Warungin database. The database should enforce uniqueness with `(tenant_id, sku)`, and server mutations/imports should validate duplicate SKU within the authenticated tenant only.

Reason:
Different merchants commonly use the same SKU values. A global SKU constraint blocks valid catalog setup and can reveal that another tenant already uses a SKU.

Impact:

- Two tenants may create or import the same SKU without conflict.
- One tenant cannot create two products with the same SKU unless the workflow is explicitly an update/upsert.
- Schema setup must migrate older `products.sku UNIQUE` tables to tenant-scoped uniqueness.

Review:
Only with explicit owner approval.

## Business Data Must Be Tenant-Owned Turso Data

Status: accepted
Date: 2026-06-08

Decision:
Business records shown in the POS/backoffice app must come from Turso tables through server functions scoped to the authenticated tenant/user. Shared local mock arrays must not be used for business lists, reports, receipts, devices, notifications, catalog, customers, suppliers, outlets, users, expenses, purchase orders, or inventory.

Reason:
Warungin is moving from an AI-builder UI prototype to a real multi-tenant POS app. Data shown after registration must belong to the registered tenant, not to shared fixtures.

Impact:

- New tenants may see honest empty states until their own records are created.
- UI-only option lists such as tabs, payment method choices, business-type choices, and formatting choices may remain static when they are configuration options rather than persisted records.
- Future writes must persist to Turso with server-side tenant ownership checks.

Review:
Only with explicit owner approval.

## Warungin Is Product Brand, Not Tenant Name

Status: accepted
Date: 2026-06-08

Decision:
Use `Warungin` as the POS web app/product brand across app chrome, marketing/auth pages, metadata, package naming, and documentation. Keep merchant/outlet names as tenant demo data, for example `Toko Maju Bersama`.

Reason:
The product needs a consistent brand while still demonstrating multi-tenant POS behavior where each customer has their own store identity.

Impact:

- Page titles, navigation brand, app metadata, package name, and product copy should use `Warungin`.
- Demo receipts, customer display, outlet names, and store settings may use example merchant data.
- Do not rename tenant sample data to `Warungin` unless the UI is explicitly showing the product brand.

Review:
Only with explicit owner approval.
