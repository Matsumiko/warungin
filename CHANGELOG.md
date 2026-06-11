# CHANGELOG

All meaningful changes to this project are recorded here.
Incomplete work must not be logged as finished.

---

## Format Reference

```markdown
## YYYY-MM-DD HH:mm TZ - [type] [area] - short title

### Summary

[What changed, why, and the outcome.]

### Type

feat / fix / refactor / security / perf / infra / docs / chore / breaking

### Area

frontend-client / admin-panel / api / auth / db / infra / docs / config

### Severity

low / medium / high / critical

### Changes

- [Specific change]

### Files

- `path/to/file` - [what changed]

### Verification

- [ ] [Verification step]

### Migration / Deploy

- Migration: [filename or none]
- Env vars: [list or none]
- Deploy steps: [steps or none]
- Rollback: [rollback path]

### Residual Risk

- [Risk or none identified]
```

---

## 2026-06-10 13:03 WIB - feat db inventory - per-outlet stock ledger

### Summary

Replaced the single global `products.stock` integer with a per-outlet stock ledger (`product_stock` table) so each outlet tracks its own inventory. Global stock is kept as a denormalized SUM of all outlet stocks for backward compatibility with dashboard, reports, and existing queries.

### Type

feat

### Area

db, api, frontend-client

### Severity

high

### Changes

- Added `product_stock` table with unique index on `(tenant_id, product_id, outlet_id)`
- Created `product-stock.server.ts` with shared helpers: `getOutletStock`, `setOutletStock`, `decrementOutletStock`, `upsertOutletStock`, `recalcGlobalStock`, `getOutletIdByName`
- `adjustProductStockHandler` now writes to both `product_stock` and `products.stock`
- `createProductHandler` seeds `product_stock` for the default outlet on creation
- `createTransactionHandler` (checkout) decrements per-outlet stock with atomic `UPDATE ... WHERE stock >= ?`
- `createTransaction` (checkout SSE) decrements per-outlet stock + recalc global aggregate
- `receivePurchaseOrder` (PO receive) upserts per-outlet stock for default outlet
- `createStockTransferHandler` decrements source outlet, upserts destination outlet, recalcs global
- CSV stock import upserts per-outlet stock for default outlet
- CSV product import seeds per-outlet stock for default outlet
- Inventory adjustment page shows outlet selector when multiple outlets exist
- Transfer page shows per-outlet stock for source outlet
- Cashier page passes outlet context from active shift to catalog
- Migration backfills existing products: global stock assigned to first active outlet

### Files

- `src/lib/db/schema.ts` - added `product_stock` table + indexes
- `src/lib/db/migrations/index.ts` - migration 008: create table + backfill
- `src/lib/product-stock.server.ts` - new shared stock helpers
- `src/lib/catalog.ts` - `getCatalogHandler` accepts optional `outletId`, `adjustProductStockHandler` uses per-outlet stock, `createProductHandler` seeds product_stock
- `src/lib/backoffice.ts` - checkout, PO receive, stock transfer, CSV import all write to `product_stock`
- `src/routes/cashier.index.tsx` - passes outlet context from active shift
- `src/routes/_app.inventory.adjustment.tsx` - outlet selector + per-outlet adjustment
- `src/routes/_app.outlets.$id.transfer.tsx` - per-outlet stock display

### Verification

- [x] `bunx tsc --noEmit` — clean
- [x] `bun run lint` — 0 errors
- [x] `bun run test:run` — 170/170 pass
- [x] `bun run build` — success

### Migration / Deploy

- Migration: 008_add_product_stock_table (auto-runs on startup)
- Env vars: none
- Deploy steps: standard deploy
- Rollback: drop `product_stock` table (global `products.stock` still has aggregate)

### Residual Risk

- Outlets with no `product_stock` rows show stock 0 in per-outlet views (migration backfill handles existing data)
- `products.stock` is recalculated on every mutation — if a recalc fails mid-batch, the aggregate could be stale until next mutation

---

## 2026-06-09 12:45 WIB - security auth - production security hardening

### Summary

Added rate limiting, security headers, PIN-based cashier login, password reset flow, and session cleanup to close the most critical production security gaps.

### Type

security

### Area

auth / api / frontend-client

### Severity

critical

### Changes

- Added dual-key login rate limiting (5 per 15min per IP, 10 per 15min per email) with in-memory sliding window and periodic cleanup.
- Added account lockout system: 10 failed attempts triggers 15-minute lockout per email, with per-IP and per-email rate limit keys.
- Added security headers middleware via TanStack Start `createMiddleware`: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, X-XSS-Protection, Permissions-Policy, and HSTS in production.
- Added `loginWithPin` server function for PIN-based cashier login (6-digit PIN, scrypt-hashed per tenant).
- Added `setUserPin` server function for owner/manager to set kasir PINs.
- Added `requestPasswordReset` and `resetPassword` server functions with SHA-256 token hashing, 1-hour expiry, rate limiting, and session invalidation on reset.
- Added `cleanupExpiredSessions` with hourly throttling to prevent unbounded session table growth.
- Added health check endpoint (`/api/health`) returning DB connectivity, uptime, and latency.
- Added `pin_hash` column to `app_users` and `password_resets` table with indexes.
- Wired login page to support email/password and PIN modes with tabbed UI.
- Created forgot-password and reset-password routes with token flow.

### Files

- `src/lib/rate-limit.ts` - dual-key rate limiter, account lockout, cleanup.
- `src/lib/auth.ts` - loginWithPin, setUserPin, requestPasswordReset, resetPassword, cleanupExpiredSessions, healthCheck.
- `src/start.ts` - securityHeadersMiddleware.
- `src/lib/db/schema.ts` - pin_hash column, password_resets table.
- `scripts/db-setup.ts` - pin_hash migration.
- `src/routes/login.tsx` - PIN mode wiring.
- `src/routes/forgot-password.tsx` - password reset request page.
- `src/routes/reset-password.tsx` - password reset form.
- `src/routes/api.health.tsx` - health check endpoint.

### Verification

- [x] `bun run build` passes.
- [x] `bun run lint` passes with 0 errors and 6 pre-existing warnings.

### Migration / Deploy

- Migration: run `bun run db:setup`; adds `pin_hash` to `app_users` and creates `password_resets` table.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run install, run schema setup, then lint/typecheck/build.
- Rollback: revert this change set; added columns/tables are additive.

### Residual Risk

- Rate limiting is in-memory; multi-instance deployments need shared state (Redis).
- Password reset tokens are displayed in-app; email delivery integration is deferred.
- CSRF protection implemented via SameSite=Strict cookie (cookie-only validation pattern).
- MFA is not implemented.

---

## 2026-06-09 14:30 WIB - infra config - testing infrastructure

### Summary

Added Vitest testing infrastructure with 52 tests across 5 files covering auth, rate-limiting, CSRF, and backoffice flows. Extracted handler functions from `createServerFn` wrappers for testability.

### Type

infra

### Area

config / api / auth

### Severity

high

### Changes

- Installed Vitest with `happy-dom` and `vite-tsconfig-paths` plugin.
- Created `vitest.config.ts` with `node` environment and `@/*` alias resolution.
- Created `src/__tests__/setup.ts` for shared test teardown.
- Created `src/__tests__/helpers.ts` with `createMockDb()` and `createMockSession()` factories.
- Added 11 unit tests for rate-limiting (`src/lib/rate-limit.test.ts`): sliding window, dual-key login rate-limit, account lockout, and cleanup.
- Added 17 unit tests for auth helpers (`src/lib/auth.test.ts`): `roleHomePath`, `canAccessAppPath`, `canAccessStandalonePath`, `hasAnyRole`.
- Added 5 unit tests for CSRF (`src/lib/csrf.test.ts`): token generation, validation, cookie handling.
- Added 7 integration tests for auth (`src/lib/auth.integration.test.ts`): login (locked, rate-limited, wrong password, valid), register tenant, logout (CSRF, session deletion).
- Added 5 integration tests for backoffice (`src/lib/backoffice.integration.test.ts`): open/close shift with cash diff calculations.
- Extracted `openShiftHandler`, `closeShiftHandler` from `src/lib/backoffice.ts` `createServerFn` wrappers.
- Extracted `logoutHandler` from `src/lib/auth.ts` `createServerFn` wrapper.
- Added `test` and `test:run` scripts to `package.json`.

### Files

- `vitest.config.ts` - Vitest configuration.
- `src/__tests__/setup.ts` - Shared test teardown.
- `src/__tests__/helpers.ts` - Mock DB and session factories.
- `src/lib/rate-limit.test.ts` - Rate-limiting unit tests.
- `src/lib/auth.test.ts` - Auth helper unit tests.
- `src/lib/csrf.test.ts` - CSRF unit tests.
- `src/lib/auth.integration.test.ts` - Auth integration tests.
- `src/lib/backoffice.integration.test.ts` - Backoffice integration tests.
- `src/lib/backoffice.ts` - Extracted `openShiftHandler`, `closeShiftHandler`.
- `src/lib/auth.ts` - Extracted `logoutHandler`.
- `package.json` - Added test scripts and devDependencies.

### Verification

- [x] `bun run test:run` — 52 tests pass across 5 files.
- [x] `bunx tsc --noEmit` — no type errors.
- [x] `bun run lint` — 0 errors, 6 pre-existing warnings.

### Migration / Deploy

- Migration: none.
- Env vars: none.
- Deploy steps: `bun install` pulls dev dependencies; no production impact.
- Rollback: revert this change set.

### Residual Risk

- `createServerFn` wrappers cannot be tested directly in Vitest due to AsyncLocalStorage dependency; tested via extracted handler functions.
- Transaction checkout flow and remaining server functions still untested.

---

## Entries

<!-- Most recent entry at the top -->

## 2026-06-09 04:31 WIB - security auth/frontend - enforce role access

### Summary

Turned persisted app-user roles into enforced access rules across route guards, navigation, login redirects, and sensitive server mutations.

### Type

security

### Area

auth / frontend-client / db

### Severity

high

### Changes

- Added central role helpers for app route access, standalone route access, role homes, and server-side role assertions.
- Login now redirects users to their role home instead of always sending everyone to dashboard.
- App route guard redirects unauthorized roles to their allowed home route.
- Cashier, shift, customer display, and print receipt routes now enforce standalone route permissions.
- Sidebar and topbar hide unauthorized menu/action entries.
- Added server-side role checks to settings, users, devices, audit logs, import/export, catalog write, checkout, and shift mutations.

### Files

- `src/lib/auth.ts` - added role types, route access maps, role home redirects, and `requireRole`.
- `src/components/app-sidebar.tsx` - filtered sidebar/topbar actions by role.
- `src/routes/_app.tsx`, `src/routes/login.tsx`, `src/routes/cashier.index.tsx`, `src/routes/cashier.shift.open.tsx`, `src/routes/cashier.shift.close.tsx`, `src/routes/customer-display.tsx`, `src/routes/print.receipt.$id.tsx` - added route/login role behavior.
- `src/lib/backoffice.ts`, `src/lib/catalog.ts` - added server-side role checks to sensitive workflows.
- `PROJECT.md`, `MODULE-MAP.md`, `SECURITY.md`, `FRONTEND.md`, `DECISIONS.md`, `BUG-HISTORY.md`, `CHANGELOG.md` - updated durable memory.

### Verification

- [x] `bunx eslint src/lib/auth.ts src/components/app-sidebar.tsx src/routes/_app.tsx src/lib/backoffice.ts src/lib/catalog.ts src/routes/cashier.index.tsx src/routes/cashier.shift.open.tsx src/routes/cashier.shift.close.tsx src/routes/customer-display.tsx src/routes/print.receipt.$id.tsx`
- [x] `bunx tsc --noEmit`
- [x] `git diff --check`
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bun audit`
- [x] `bun run build`
- [x] Playwright smoke: created kasir/gudang/display users and verified role home redirects plus denied-route redirects.

### Migration / Deploy

- Migration: none.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run install, run schema setup, then lint/typecheck/audit/build.
- Rollback: revert this change set.

### Residual Risk

- CSRF hardening, rate limiting, MFA, and password reset are still not implemented.
- Some lower-risk read-only server loaders still rely on route guards plus tenant scoping rather than explicit role checks.

## 2026-06-09 04:12 WIB - fix db/auth - tenant-scoped product SKU uniqueness

### Summary

Moved product SKU uniqueness from global database scope to tenant scope so different merchants can use the same SKU without cross-tenant conflicts.

### Type

fix

### Area

db / auth

### Severity

high

### Changes

- Removed global `UNIQUE` from `products.sku` in the canonical schema.
- Added unique index `idx_products_tenant_sku` on `(tenant_id, sku)`.
- Added idempotent schema setup migration that rebuilds old `products` tables still carrying global `sku UNIQUE`.
- Added tenant-scoped duplicate SKU checks in direct product create/update flows.
- Updated CSV import duplicate messaging to match tenant-scoped SKU behavior.

### Files

- `src/lib/db/schema.ts` - changed product SKU uniqueness to tenant-scoped index.
- `scripts/db-setup.ts` - added migration for existing global-SKU tables.
- `src/lib/catalog.ts` - added tenant duplicate checks before product create/update.
- `src/lib/backoffice.ts` - updated import duplicate SKU message.
- `PROJECT.md`, `MODULE-MAP.md`, `SECURITY.md`, `DECISIONS.md`, `BUG-HISTORY.md`, `CHANGELOG.md` - updated durable memory.

### Verification

- [x] `bun run db:setup`
- [x] `bunx eslint scripts/db-setup.ts src/lib/db/schema.ts src/lib/catalog.ts src/lib/backoffice.ts`
- [x] `bunx tsc --noEmit`
- [x] `git diff --check`
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bun audit`
- [x] `bun run build`
- [x] Playwright smoke: registered two fresh tenants, imported product CSV with SKU `SAME-SKU-QA` into both tenants, and verified each tenant sees its own product.

### Migration / Deploy

- Migration: run `bun run db:setup`; it rebuilds old `products` tables that still have global `sku UNIQUE` and creates `idx_products_tenant_sku`.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run install, run schema setup, then lint/typecheck/audit/build.
- Rollback: restore from database backup or revert this change set before rerunning schema setup; table rebuild migrations should be rehearsed before production use.

### Residual Risk

- The table rebuild migration is additive in behavior but structural in implementation; take a Turso backup before applying to production data.
- Remaining partial areas include payment provider behavior, full stock-per-outlet ledgering, role enforcement, CSRF hardening, and rate limiting.

## 2026-06-09 04:01 WIB - feat db/frontend - real import export workflows

### Summary

Made the Import & Export page perform real tenant-scoped file actions instead of showing fake toast-only responses.

### Type

feat

### Area

db / frontend-client

### Severity

medium

### Changes

- Added tenant-scoped export server function for products, transactions, shifts, and stock data.
- Export buttons now download real CSV, Excel-compatible TSV, or simple PDF files and record audit log activity.
- Added CSV import server function for product upsert and stock updates.
- Product CSV import creates missing categories and creates/updates products by tenant SKU.
- Stock CSV import updates product stock by SKU and records stock-adjustment history.
- Template downloads now generate real CSV files client-side.
- Import/export activity refreshes from `audit_logs` after successful actions.

### Files

- `src/lib/backoffice.ts` - added export/import parsing, file generation payloads, tenant writes, and audit logging.
- `src/routes/_app.import-export.tsx` - wired export buttons, template downloads, and CSV file inputs to real handlers.
- `PROJECT.md`, `MODULE-MAP.md`, `SECURITY.md`, `FRONTEND.md`, `BUG-HISTORY.md`, `CHANGELOG.md` - updated durable memory.

### Verification

- [x] `bun run db:setup`
- [x] `bunx eslint src/lib/backoffice.ts src/routes/_app.import-export.tsx`
- [x] `bunx tsc --noEmit`
- [x] `git diff --check`
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bun audit`
- [x] `bun run build`
- [x] Playwright smoke: registered a fresh tenant, imported product CSV, verified product list, exported product CSV and received a downloaded file, imported stock CSV, and verified stock changed to 14 pcs.

### Migration / Deploy

- Migration: none; existing `audit_logs`, `categories`, and `products` tables are used.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run install, run schema setup, then lint/typecheck/audit/build.
- Rollback: revert this change set.

### Residual Risk

- CSV import is immediate and has no preview/approval screen or per-row downloadable error report.
- Remaining partial areas include payment provider behavior, full stock-per-outlet ledgering, role enforcement, CSRF hardening, and rate limiting.

## 2026-06-09 03:44 WIB - feat db/frontend - apply tenant tax settings at checkout

### Summary

Applied persisted tenant tax and service charge settings to cashier checkout, latest customer display, and print receipts, with server-side total validation before transaction persistence.

### Type

feat

### Area

db / frontend-client / auth

### Severity

medium

### Changes

- Added additive `transactions.service_charge` schema support.
- Cashier now loads tenant settings and shows PPN/service rows only when applicable.
- Checkout submission includes service charge, and `createTransaction` recomputes subtotal, tax, service charge, and total from tenant-owned products/settings before saving.
- Customer display and print receipt now show tax labels from tenant settings and service charge amounts from the saved transaction.
- Receipt number formatting now uses stable project formatting to avoid hydration mismatches.

### Files

- `src/lib/db/schema.ts`, `scripts/db-setup.ts` - added service charge transaction column setup.
- `src/lib/backoffice.ts` - added tenant settings total calculation and server-side checkout validation.
- `src/routes/cashier.index.tsx` - applied tenant tax/service settings to cart totals and checkout payload.
- `src/routes/customer-display.tsx` - applied tenant tax/service labels to latest transaction display.
- `src/routes/print.receipt.$id.tsx` - applied tenant tax/service labels to receipts and fixed number formatting stability.
- `PROJECT.md`, `MODULE-MAP.md`, `SECURITY.md`, `BUG-HISTORY.md`, `CHANGELOG.md` - updated durable memory.

### Verification

- [x] `bun run db:setup`
- [x] `bunx tsc --noEmit`
- [x] `git diff --check`
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bun audit`
- [x] `bun run build`
- [x] Playwright smoke: registered a fresh tenant, set PPN 10%, service 5%, exclusive tax mode, sold a Rp 10.000 product, and verified cashier/customer display/receipt totals all reached Rp 11.500 with matching line items.

### Migration / Deploy

- Migration: run `bun run db:setup`; it adds `transactions.service_charge` if missing.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run install, run schema setup, then lint/typecheck/audit/build.
- Rollback: revert this change set; the added column is additive and is not automatically dropped.

### Residual Risk

- Existing transactions from before this change default `service_charge` to 0.
- Remaining partial areas include import/export file processing, payment provider behavior, full stock-per-outlet ledgering, role enforcement, CSRF hardening, and rate limiting.

## 2026-06-09 03:25 WIB - feat db/frontend - tenant settings persistence

### Summary

Made the settings page persist tenant-owned configuration to Turso instead of only showing a success toast.

### Type

feat

### Area

db / frontend-client / auth

### Severity

medium

### Changes

- Added additive `tenant_settings` key-value schema and tenant index.
- Added tenant-scoped settings loader and update server functions with allowlisted setting keys.
- Store name saves to the tenant record so session-backed display names can refresh.
- Settings form fields now submit named values and toggle controls submit hidden `1`/`0` values.
- Settings save now calls the server mutation, shows real success/error toasts, and invalidates route data.

### Files

- `src/lib/db/schema.ts`, `scripts/db-setup.ts` - added settings schema setup.
- `src/lib/backoffice.ts` - added tenant settings defaults, loader, and update mutation.
- `src/routes/_app.settings.tsx` - wired settings form to persisted tenant settings.
- `PROJECT.md`, `MODULE-MAP.md`, `SECURITY.md`, `BUG-HISTORY.md`, `CHANGELOG.md` - updated durable memory.

### Verification

- [x] `bun run db:setup`
- [x] `bunx tsc --noEmit`
- [x] `git diff --check`
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bun audit`
- [x] `bun run build`
- [x] Playwright smoke: registered a fresh tenant, saved Toko settings, reloaded and verified persisted values, saved Pajak settings, reloaded and verified persisted values.

### Migration / Deploy

- Migration: run `bun run db:setup`; it creates `tenant_settings` and index if missing.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run install, run schema setup, then lint/typecheck/audit/build.
- Rollback: revert this change set; the added table is additive and is not automatically dropped.

### Residual Risk

- Persisted settings are not yet applied to cashier tax calculation or receipt rendering; this batch makes the settings durable first.
- Logo upload still has no file storage implementation.
- Remaining partial areas include import/export file processing, payment provider behavior, full stock-per-outlet ledgering, role enforcement, CSRF hardening, and rate limiting.

## 2026-06-08 21:00 WIB - feat db/frontend - PO item receiving updates inventory

### Summary

Made purchase orders item-based and connected receiving to product stock so PO lifecycle now affects inventory instead of only changing status.

### Type

feat

### Area

db / frontend-client

### Severity

high

### Changes

- Added additive `purchase_order_items` schema and tenant indexes.
- PO creation now selects real tenant products, stores item rows, and computes totals server-side.
- PO detail now loads and displays persisted item rows.
- Receiving a PO now increments product stock, marks the PO `received`, and records a stock-history audit entry.
- Inventory history includes PO receipt events.

### Files

- `src/lib/db/schema.ts`, `scripts/db-setup.ts` - added purchase order item schema setup.
- `src/lib/backoffice.ts` - added PO detail loader, item creation, and receiving mutation.
- `src/routes/_app.purchase-orders.new.tsx` - replaced manual total entry with product item rows.
- `src/routes/_app.purchase-orders.$id.tsx` - wired detail item display and receive action.
- `PROJECT.md`, `MODULE-MAP.md`, `SECURITY.md`, `BUG-HISTORY.md`, `CHANGELOG.md` - updated durable memory.

### Verification

- [x] `bun run db:setup`
- [x] `bunx tsc --noEmit`
- [x] `git diff --check`
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bun audit`
- [x] `bun run build`
- [x] Playwright smoke: registered a fresh tenant, created category/product with stock 0, created a PO item qty 7, received it, verified product stock became 7, and verified inventory history recorded the receipt.

### Migration / Deploy

- Migration: run `bun run db:setup`; it creates `purchase_order_items` and indexes if missing.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run install, run schema setup, then lint/typecheck/audit/build.
- Rollback: revert this change set; the added table is additive and is not automatically dropped.

### Residual Risk

- Receiving is all-or-nothing for the whole PO; partial receiving/backorders are not implemented yet.
- Product stock remains global per tenant; full stock-per-outlet ledgering is still not implemented.
- Remaining partial areas include settings persistence, import/export file processing, role enforcement, CSRF hardening, and rate limiting.

## 2026-06-08 20:43 WIB - feat db/frontend - customer and outlet delete flows

### Summary

Made customer deletion and outlet removal usable with tenant-scoped Turso mutations instead of leaving those records stuck after creation.

### Type

feat

### Area

db / frontend-client

### Severity

medium

### Changes

- Added tenant-scoped customer hard delete.
- Added tenant-scoped outlet soft-delete so stock-transfer and shift history references are preserved.
- Outlet delete is blocked when an open shift exists for that outlet name.
- Customer list and outlet cards now expose destructive delete actions with confirm dialogs, toasts, per-row/card disabled states, and loader refresh.

### Files

- `src/lib/backoffice.ts` - added customer delete and outlet soft-delete server functions.
- `src/routes/_app.customers.index.tsx` - wired customer row delete action.
- `src/routes/_app.outlets.index.tsx` - wired outlet card delete action.
- `PROJECT.md`, `MODULE-MAP.md`, `SECURITY.md`, `BUG-HISTORY.md`, `CHANGELOG.md` - updated durable memory.

### Verification

- [x] `bunx tsc --noEmit`
- [x] `git diff --check`
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bun audit`
- [x] `bun run build`
- [x] Playwright smoke: registered a fresh tenant, created/deleted a customer, created/soft-deleted an outlet, and confirmed both lists returned to empty state.

### Migration / Deploy

- Migration: none; existing `customers` and `outlets.active` schema is used.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run install, run schema setup, then lint/typecheck/audit/build.
- Rollback: revert this change set.

### Residual Risk

- Customer delete is hard delete because transactions do not currently store `customer_id`.
- Outlet open-shift guard uses the current outlet name because shift reports store `outlet_name`, not `outlet_id`.
- Remaining partial areas include settings persistence, import/export file processing, PO item receiving into inventory, role enforcement, CSRF hardening, and rate limiting.

## 2026-06-08 20:26 WIB - feat db/frontend - supplier and promotion management

### Summary

Made supplier and promotion management usable with tenant-scoped Turso mutations instead of read-only cards and UI-only controls.

### Type

feat

### Area

db / frontend-client

### Severity

medium

### Changes

- Added tenant-scoped supplier update/delete server functions.
- Supplier list now supports inline edit and guarded delete.
- Added tenant-scoped promotion create/update/delete server functions.
- Promotion screen now supports create, edit, activate/deactivate, and delete.

### Files

- `src/lib/backoffice.ts` - added supplier and promotion mutations.
- `src/routes/_app.suppliers.index.tsx` - wired supplier inline edit/delete.
- `src/routes/_app.promotions.tsx` - wired promotion create/edit/toggle/delete.
- `PROJECT.md`, `MODULE-MAP.md`, `SECURITY.md`, `BUG-HISTORY.md`, `CHANGELOG.md` - updated durable memory.

### Verification

- [x] `bunx tsc --noEmit`
- [x] `git diff --check`
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bun audit`
- [x] `bun run build`
- [x] Playwright smoke: registered a fresh tenant, created/edited/deleted supplier, and created/toggled/edited/deleted promotion.

### Migration / Deploy

- Migration: none; existing `suppliers` and `promotions` tables are used.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run install, run schema setup, then lint/typecheck/audit/build.
- Rollback: revert this change set.

### Residual Risk

- Supplier delete is blocked when the supplier name is referenced by purchase orders, but purchase orders still store supplier names rather than `supplier_id`.
- Remaining partial areas include settings persistence, import/export file processing, customer delete, outlet delete, PO item receiving into inventory, role enforcement, CSRF hardening, and rate limiting.

## 2026-06-08 19:47 WIB - feat db/frontend - shift, device, and PO status persistence

### Summary

Wired another set of UI-only operational flows to tenant-scoped Turso writes: cashier shift open/close, purchase order status updates, and device pairing/logout persistence.

### Type

feat

### Area

db / frontend-client / auth

### Severity

high

### Changes

- Added additive `shift_reports.opening_cash` and `shift_reports.closing_cash` schema setup.
- Added server functions for opening shifts, closing shifts, active-shift cash calculation, purchase order status updates, device pairing requests, and device logout.
- Shift close now calculates expected cash from opening cash plus cash transactions since the shift opened.
- Purchase order detail can move draft POs to sent, received, or cancelled states.
- Device pairing creates a pending device row in Turso and shows the generated pairing code; device logout persists offline state.

### Files

- `src/lib/db/schema.ts`, `scripts/db-setup.ts` - added shift cash columns.
- `src/lib/backoffice.ts` - added shift, PO status, and device mutations/loaders.
- `src/routes/cashier.shift.open.tsx`, `src/routes/cashier.shift.close.tsx` - wired real shift persistence.
- `src/routes/_app.purchase-orders.$id.tsx`, `src/routes/_app.purchase-orders.index.tsx` - wired PO status lifecycle labels/actions.
- `src/routes/_app.devices.tsx` - wired device pairing and logout persistence.
- `PROJECT.md`, `MODULE-MAP.md`, `SECURITY.md`, `BUG-HISTORY.md`, `CHANGELOG.md` - updated durable memory.

### Verification

- [x] `bun run db:setup`
- [x] `bunx tsc --noEmit`
- [x] `git diff --check`
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bun audit`
- [x] `bun run build`
- [x] Playwright smoke: registered a fresh tenant, opened/closed shift, verified shift report, created PO and updated to received, created device pairing request, and verified the device persisted after reload.

### Migration / Deploy

- Migration: run `bun run db:setup`; it adds `shift_reports.opening_cash` and `shift_reports.closing_cash` if missing.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run install, run schema setup, then lint/typecheck/audit/build.
- Rollback: revert this change set; the added shift columns are additive and are not automatically dropped.

### Residual Risk

- Device pairing is represented as persisted pending requests; it does not yet include a real second-device handshake endpoint.
- Purchase orders still do not have item rows or stock receiving into inventory.
- Remaining partial areas include settings persistence, import/export file processing, customer delete, outlet delete, role enforcement, CSRF hardening, and rate limiting.

## 2026-06-08 19:19 WIB - feat db/frontend - backoffice writes and transfer requests

### Summary

Moved another batch of Warungin backoffice actions from UI-only behavior to tenant-scoped Turso writes, covering customer detail/edit, expenses, users, outlet editing, and outlet stock-transfer requests.

### Type

feat

### Area

db / frontend-client / auth

### Severity

high

### Changes

- Added `stock_transfers` schema setup and indexes for persisted outlet transfer requests.
- Added tenant-scoped customer detail/update functions and replaced the customer detail placeholder page with a real edit form.
- Added tenant-scoped expense creation from `/expenses`.
- Added tenant-scoped app-user creation from `/users` using the same scrypt password hash format as registration.
- Added inline outlet editing on `/outlets`.
- Replaced the outlet transfer placeholder with a real request form and DB-backed request history.
- Awaited router invalidation after new submit flows so post-save lists refresh deterministically.

### Files

- `src/lib/db/schema.ts`, `scripts/db-setup.ts` - added stock transfer schema setup.
- `src/lib/backoffice.ts` - added customer detail/update, expense create, user create, outlet update, stock-transfer create/list functions.
- `src/routes/_app.customers.$id.tsx` - replaced placeholder with real customer detail/edit page.
- `src/routes/_app.expenses.tsx` - wired expense creation.
- `src/routes/_app.users.tsx` - wired user creation.
- `src/routes/_app.outlets.index.tsx` - wired outlet editing.
- `src/routes/_app.outlets.$id.transfer.tsx` - replaced placeholder with stock-transfer request form/history.
- `PROJECT.md`, `MODULE-MAP.md`, `SECURITY.md`, `BUG-HISTORY.md`, `CHANGELOG.md` - updated durable memory.

### Verification

- [x] `bun run db:setup`
- [x] `bunx tsc --noEmit`
- [x] `git diff --check`
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bun audit`
- [x] `bun run build`
- [x] Playwright smoke: registered a fresh tenant, created and edited a customer, recorded an expense, created a user, edited an outlet, submitted a stock-transfer request, and verified the transfer request appeared after reload.

### Migration / Deploy

- Migration: run `bun run db:setup`; it adds `stock_transfers` if missing.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run install, run schema setup, then lint/typecheck/audit/build.
- Rollback: revert this change set; the added `stock_transfers` table is additive and is not automatically dropped.

### Residual Risk

- Stock-transfer requests are persisted but do not yet maintain a true per-outlet stock ledger or approval lifecycle.
- Remaining partial areas include settings persistence, import/export file processing, device pairing behavior, promotions, supplier edit/delete, customer delete, outlet delete, and full purchase order receive/cancel item lifecycle.
- Mutations are authenticated and tenant-scoped, but still need CSRF hardening, rate limiting, and role-based authorization.

## 2026-06-08 18:45 WIB - feat db/frontend - product variants and inventory workflows

### Summary

Replaced several UI-only Warungin actions with tenant-scoped Turso writes and loaders so the product, category, inventory, and purchase-order flows named during QA are usable with real data.

### Type

feat

### Area

db / frontend-client

### Severity

high

### Changes

- Added `product_variants` schema support and route-safe catalog functions for variant create/update reads.
- Wired product creation and product editing to persist variants, prices, stock, category, barcode, and status fields.
- Linked product list action buttons to the real product edit route.
- Added category inline edit and guarded delete behavior backed by tenant-scoped mutations.
- Added inventory stock adjustment writes, inventory adjustment history from audit logs, and inventory stock report data from the catalog.
- Added simple purchase order draft creation backed by Turso.

### Files

- `src/lib/db/schema.ts`, `scripts/db-setup.ts` - added product variant table setup.
- `src/lib/catalog.ts`, `src/lib/catalog.types.ts` - added variant, product update, category update/delete, stock adjustment, and inventory report functions/types.
- `src/lib/backoffice.ts` - added purchase order draft creation support.
- `src/routes/_app.products.new.tsx`, `src/routes/_app.products.$id.tsx`, `src/routes/_app.products.index.tsx` - wired product create/edit/list actions.
- `src/routes/_app.categories.tsx` - wired category edit/delete.
- `src/routes/_app.inventory.adjustment.tsx`, `src/routes/_app.inventory.history.tsx`, `src/routes/_app.reports.inventory.tsx` - wired inventory adjustment/history/report.
- `src/routes/_app.purchase-orders.new.tsx` - wired purchase order draft creation.
- `PROJECT.md`, `MODULE-MAP.md`, `SECURITY.md`, `BUG-HISTORY.md`, `CHANGELOG.md` - updated durable memory.

### Verification

- [x] `bun run db:setup`
- [x] `bunx tsc --noEmit`
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bun audit`
- [x] `bun run build`
- [x] Playwright smoke: registered a fresh tenant, created category/product with variant, reloaded product edit, edited product, adjusted stock, checked inventory history/report, and created a purchase order draft.

### Migration / Deploy

- Migration: run `bun run db:setup`; it adds `product_variants` if missing.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run install, run schema setup, then lint/typecheck/audit/build.
- Rollback: revert this change set; the added `product_variants` table is additive and is not automatically dropped.

### Residual Risk

- Remaining non-functional or partial areas include customer detail, outlet transfer, full purchase order lifecycle/detail actions, import/export file processing, settings persistence, device pairing behavior, role/user management, expenses, promotions, and broader edit/delete flows for supplier/customer/outlet records.
- Mutations are authenticated and tenant-scoped, but still need CSRF hardening, rate limiting, and role-based authorization.

## 2026-06-08 18:11 WIB - fix frontend/db - remove import/export fake activity

### Summary

Removed the static Import / Export activity history that still showed fake filenames and replaced it with tenant-scoped Turso audit log activity.

### Type

fix

### Area

frontend-client / db

### Severity

medium

### Changes

- Deleted the hard-coded import/export `recent` activity records from `/import-export`.
- Added a tenant-scoped `getImportExportActivity` server function backed by `audit_logs`.
- Import/export history now shows real `import.*` and `export.*` audit entries, or an honest empty state when none exist.

### Files

- `src/routes/_app.import-export.tsx` - replaced static activity list with loader data.
- `src/lib/backoffice.ts` - added import/export activity loader.

### Verification

- [x] `rg` found no removed fake activity filenames.
- [x] `bunx tsc --noEmit`
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bun run build`

### Migration / Deploy

- Migration: none
- Env vars: none new
- Deploy steps: normal build/deploy
- Rollback: revert this change set.

### Residual Risk

- Export/import buttons still need real file generation/upload processing; this only removes fake history data.

## 2026-06-08 17:51 WIB - feat db/frontend - usable tenant write flows

### Summary

Made the next core Warungin flows usable with real tenant-owned Turso writes: create catalog/backoffice records, checkout from the cashier, update stock, report from transactions, and log out from the app shell.

### Type

feat

### Area

db / frontend-client / auth / docs

### Severity

high

### Changes

- Added tenant-scoped create mutations for categories, products, suppliers, customers, and outlets.
- Wired `/categories`, `/products/new`, `/suppliers/new`, `/customers`, and `/outlets` forms to Turso server functions.
- Added cashier checkout persistence through `transactions` and `transaction_items`.
- Checkout now validates tenant-owned products, checks stock, decrements product stock, and writes an audit log entry.
- Sales, payment, and profit reports now aggregate from real `transactions` instead of precomputed placeholder aggregate tables.
- Added `payment_method` migration support for existing `transactions` tables.
- Added visible logout in the app topbar and session deletion through the existing logout server function.
- Fixed async inline form reset errors by capturing the form element before awaiting server mutations.

### Files

- `src/lib/catalog.ts` - category/product create mutations.
- `src/lib/backoffice.ts` - supplier/customer/outlet create mutations and checkout transaction persistence.
- `src/lib/db/schema.ts`, `scripts/db-setup.ts` - `transactions.payment_method` schema/migration.
- `src/routes/_app.categories.tsx`, `src/routes/_app.products.new.tsx`, `src/routes/_app.suppliers.new.tsx`, `src/routes/_app.customers.index.tsx`, `src/routes/_app.outlets.index.tsx` - real create forms.
- `src/routes/cashier.index.tsx` - checkout writes transactions and refreshes catalog stock.
- `src/components/app-sidebar.tsx`, `src/routes/_app.tsx` - session-aware app shell and topbar logout.
- `PROJECT.md`, `MODULE-MAP.md`, `SECURITY.md`, `BUG-HISTORY.md`, `CHANGELOG.md` - durable memory updates.

### Verification

- [x] `bun run db:setup`
- [x] `bunx tsc --noEmit`
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bun run build`
- [x] `bun audit`
- [x] Playwright smoke: registered a fresh tenant, created category/product, completed checkout, and saw sales/payment reports reflect the transaction.
- [x] Playwright smoke: created supplier/customer/outlet records and logged out through the topbar.

### Migration / Deploy

- Migration: run `bun run db:setup`; it adds `transactions.payment_method` when missing.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run install, run schema setup, then lint/typecheck/audit/build.
- Rollback: revert this change set; the added `payment_method` column is additive and is not automatically dropped.

### Residual Risk

- Remaining write flows still needed: edit/delete records, expenses, purchase orders, stock adjustment/history, user management, settings persistence, and real payment provider integration.
- Mutations are authenticated and tenant-scoped, but still need CSRF hardening, rate limiting, and role-based authorization.

## 2026-06-08 17:26 WIB - feat auth/db - tenant auth and Turso-owned data

### Summary

Added the first real auth and tenant-ownership foundation for Warungin, then moved remaining POS/backoffice business lists and reports off shared mock data into Turso-backed server functions with tenant scoping.

### Type

feat

### Area

auth / db / frontend-client / docs

### Severity

high

### Changes

- Added tenant registration, login, scrypt password hashing, Turso-backed sessions, and an HttpOnly session cookie.
- Added tenant/user/session tables and tenant IDs across business tables in the idempotent Turso schema setup.
- Guarded authenticated app, cashier, customer-display, and receipt routes with the current session.
- Added Turso-backed server functions for suppliers, customers, outlets, users, expenses, purchase orders, sales/payment/shift/profit reports, receipts, audit logs, notifications, devices, and promotions.
- Deleted shared mock-data usage and replaced tenant-empty screens with honest empty states.
- Removed remaining business-looking static outlet/address/printer values from reports, cashier, and settings.
- Updated durable project memory for auth, tenant ownership, Turso data boundaries, and remaining security gaps.

### Files

- `src/lib/auth.ts` - tenant registration/login/session helpers.
- `src/lib/backoffice.ts` - tenant-scoped Turso loaders for backoffice data.
- `src/lib/catalog.ts`, `src/lib/catalog.types.ts`, `src/lib/format.ts` - tenant-scoped catalog loader and shared non-mock utilities.
- `src/lib/db/schema.ts`, `scripts/db-setup.ts` - additive tenant/auth/business schema setup and migration helpers.
- `src/routes/*` - authenticated route guards and Turso-backed loaders/empty states.
- `PROJECT.md`, `MODULE-MAP.md`, `SECURITY.md`, `DECISIONS.md`, `FRONTEND.md`, `CHANGELOG.md` - durable memory updates.

### Verification

- [x] `bun run db:setup`
- [x] `bunx tsc --noEmit`
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bun run build`
- [x] `bun audit`
- [x] Playwright smoke: unauthenticated `/dashboard` redirects to `/login`.
- [x] Playwright smoke: `/register` creates a new tenant/user and reaches `/dashboard`.
- [x] Playwright smoke: new tenant sees tenant-scoped empty business data instead of shared fixtures.
- [x] Literal scan found no remaining `@/lib/mock-data` imports or removed fake outlet/address/printer values.

### Migration / Deploy

- Migration: run `bun run db:setup`; it is additive/idempotent and adds auth, tenant, session, and business tables/columns.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run install, run schema setup, then lint/typecheck/audit/build.
- Rollback: revert this change set; Turso schema additions are additive and are not automatically dropped.

### Residual Risk

- Auth is an MVP foundation: no rate limiting, MFA, password reset, logout/session revocation UI, or role-based authorization enforcement yet.
- Many business workflows still need real write mutations, including checkout persistence, inventory mutation, settings save, supplier/customer/outlet/product creation, and reports generated from actual transaction writes.

## 2026-06-08 16:58 WIB - refactor data - remove shared mock catalog

### Summary

Removed the shared `src/lib/mock-data.ts` dependency and made catalog-facing screens rely on Turso data or honest empty states instead of shared mock arrays.

### Type

refactor

### Area

db / frontend-client / docs

### Severity

medium

### Changes

- Deleted `src/lib/mock-data.ts`.
- Moved catalog TypeScript contracts to `src/lib/catalog.types.ts`.
- Moved currency and number formatting helpers to `src/lib/format.ts`.
- Changed `bun run db:setup` to schema-only; it no longer inserts placeholder product/category rows.
- Updated categories, inventory, products/new, dashboard, and product reports to load catalog data from Turso.
- Replaced shared mock imports on unsupported modules with empty states until those modules get real Turso tables.

### Files

- `src/lib/mock-data.ts` - removed.
- `src/lib/catalog.types.ts`, `src/lib/format.ts` - added non-mock shared utilities.
- `scripts/db-setup.ts` - removed placeholder seed inserts.
- `src/routes/*` - removed all `@/lib/mock-data` imports and routed catalog views to Turso or empty states.
- `PROJECT.md`, `MODULE-MAP.md`, `CHANGELOG.md` - updated durable memory.

### Verification

- [x] `bun run db:setup` reported Turso schema ready with 5 categories and 20 products.
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bunx tsc --noEmit`
- [x] `bun run build`
- [x] `bun audit`

### Migration / Deploy

- Migration: `bun run db:setup` remains additive/idempotent schema setup only.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: run normal install, schema setup, lint, typecheck, audit, and build pipeline.
- Rollback: revert this change set to restore shared mock-data imports.

### Residual Risk

- Non-catalog modules such as suppliers, customers, users, outlets, payment reports, and sales reports now show empty states until their Turso tables/server functions are implemented.

## 2026-06-08 16:47 WIB - feat db - Turso-backed catalog slice

### Summary

Added the first real Turso-backed data path for Warungin by wiring product/category catalog reads into the products and cashier screens, plus an idempotent schema/seed setup script.

### Type

feat

### Area

db / frontend-client / docs

### Severity

medium

### Changes

- Added Turso/libSQL dependency, environment placeholders, and `.env` ignore rules.
- Added idempotent `categories` and `products` schema setup with seed data from existing Warungin mock catalog.
- Added a TanStack Start server function catalog loader that keeps the Turso client behind a server-only import.
- Updated `/products` and `/cashier` to load catalog data from Turso instead of static runtime arrays.
- Fixed cashier checkout modal overflow so the payment completion button remains reachable on short viewports.
- Updated durable project memory for Turso commands, env keys, module boundaries, and secret handling.

### Files

- `.gitignore`, `.env.example` - documented and protected local Turso environment configuration.
- `package.json`, `bun.lock` - added `@libsql/client` and `db:setup`.
- `src/lib/db/schema.ts`, `src/lib/db/turso.server.ts`, `scripts/db-setup.ts` - added Turso schema, client, and seed setup.
- `src/lib/catalog.ts` - added route-safe catalog server function.
- `src/routes/_app.products.index.tsx`, `src/routes/cashier.index.tsx` - switched catalog reads to Turso and fixed checkout modal overflow.
- `PROJECT.md`, `MODULE-MAP.md`, `SECURITY.md`, `FRONTEND.md`, `CHANGELOG.md` - updated durable memory.

### Verification

- [x] `bun run db:setup` completed against Turso with 5 categories and 20 products.
- [x] `bun run lint` passes with 0 errors and 6 existing Fast Refresh warnings.
- [x] `bunx tsc --noEmit`
- [x] `bun run build`
- [x] `bun audit`
- [x] Playwright smoke test: `/products` rendered 20 Turso products.
- [x] Playwright smoke test: `/cashier` rendered active products, added Aqua 600ml, opened checkout, completed payment, and returned to an empty cart.

### Migration / Deploy

- Migration: `bun run db:setup` creates idempotent Turso tables and seed rows.
- Env vars: `TURSO_DB_URL`, `TURSO_DB_TOKEN`
- Deploy steps: set Turso env vars, run `bun install`, run `bun run db:setup`, then normal lint/typecheck/audit/build pipeline.
- Rollback: revert this change set; existing Turso tables are additive and non-destructive.

### Residual Risk

- Only product/category catalog reads are backed by Turso. Auth, checkout persistence, inventory mutations, reports, and payment workflows still need real backend work.
- Seed setup uses `INSERT OR IGNORE`; it will not update existing seed rows if mock seed values change later.

## 2026-06-08 13:15 Asia/Jakarta - chore qa - branding and quality baseline

### Summary

Initialized local Git tracking, corrected the Warungin brand scope, cleaned formatting/lint blockers, resolved dependency audit findings, and ran browser QA across the main POS surfaces.

### Type

chore

### Area

frontend-client / config / docs

### Severity

medium

### Changes

- Initialized a local Git repository on `main` and created an initial baseline commit.
- Standardized product branding to `Warungin` while keeping tenant demo data as `Toko Maju Bersama`.
- Formatted the project with Prettier and fixed TypeScript/React Hooks lint errors.
- Updated TanStack and lint tooling dependencies to clear the TanStack Start audit advisory.
- Added a `brace-expansion@5.0.6` override to resolve the remaining transitive audit advisory.
- Added `public/favicon.svg` and linked it from the root document head.
- Recorded the accepted brand decision and updated durable project/frontend/security memory.

### Files

- `package.json` - updated dependencies and added the patched transitive override.
- `bun.lock` - updated dependency graph and project package name.
- `src/routes/*` - formatted routes, updated branding, and fixed lint errors.
- `src/components/*` - formatted shared UI/app shell files and updated app brand.
- `src/lib/mock-data.ts` - retained tenant demo naming while preserving product brand separation.
- `public/favicon.svg` - added Warungin favicon.
- `PROJECT.md`, `FRONTEND.md`, `DECISIONS.md`, `SECURITY.md`, `CHANGELOG.md` - updated durable memory.

### Verification

- [x] `git init -b main` and initial local baseline commit created.
- [x] Brand scan: no `Kasir Maju`, `KasirMaju`, old scaffold package name, or builder-specific terms remain in project files.
- [x] `bun run lint` passes with 0 errors and 6 non-blocking Fast Refresh warnings.
- [x] `bunx tsc --noEmit`
- [x] `bun run build`
- [x] `bun audit`
- [x] Playwright route traversal for `/`, `/login`, `/register`, `/dashboard`, `/cashier`, `/customer-display`, `/settings`, `/products`, `/reports/sales`, and `/devices` returned 200 responses without route console errors.
- [x] Playwright mobile checks for `/`, `/login`, `/register`, `/cashier`, and `/dashboard` found no page-level horizontal overflow.
- [x] Favicon 404 was fixed; fresh Playwright tab reported 0 console errors on landing.

### Migration / Deploy

- Migration: none
- Env vars: none
- Deploy steps: run `bun install`, `bun run lint`, `bunx tsc --noEmit`, `bun audit`, and `bun run build`
- Rollback: revert the QA/branding commit or restore the initial baseline commit

### Residual Risk

- Six Fast Refresh warnings remain in shadcn-style UI primitive files; they do not fail lint.
- No real backend/auth/data persistence is wired yet, so QA covers the current mock frontend behavior only.

## 2026-06-08 12:45 Asia/Jakarta - chore config - remove AI-builder scaffold dependencies

### Summary

Removed direct AI-builder dependencies and replaced the Vite setup with official TanStack Start/Vite plugins. Build remains valid without builder-specific packages or browser error bridge hooks.

### Type

chore

### Area

config

### Severity

low

### Changes

- Replaced the builder Vite wrapper with official Vite plugins.
- Removed the builder browser error reporting bridge.
- Removed builder package exceptions from Bun install config.
- Renamed the package manifest from the scaffold default to `warungin`.
- Removed unused direct router plugin dependency from the manifest; TanStack Start still provides what it needs transitively.
- Regenerated `bun.lock` without builder packages.

### Files

- `package.json` - renamed package and removed the builder Vite wrapper.
- `vite.config.ts` - switched to official TanStack Start, React, Tailwind, and tsconfig paths plugins.
- `src/routes/__root.tsx` - removed builder error reporter integration.
- `src/lib/` - deleted the builder browser event bridge file.
- `bunfig.toml` - removed builder minimum-release-age excludes.
- `bun.lock` - regenerated dependency graph without builder packages.
- `PROJECT.md` - recorded verified project stack, commands, and gotchas.
- `FRONTEND.md` - recorded actual frontend baseline.
- `MODULE-MAP.md` - mapped routing, UI, and POS demo modules.

### Verification

- [x] Builder-specific repository scan returned no matches.
- [x] `bunx eslint vite.config.ts src/routes/__root.tsx`
- [x] `bun run build`
- [ ] `bun run lint` fails on pre-existing Prettier formatting errors across many files outside this cleanup scope.

### Migration / Deploy

- Migration: none
- Env vars: none
- Deploy steps: run normal install/build pipeline
- Rollback: restore prior `package.json`, `bun.lock`, `vite.config.ts`, and builder reporter file if AI-builder integration is needed again

### Residual Risk

- Repository-wide lint remains blocked by existing formatting drift unrelated to this cleanup.
