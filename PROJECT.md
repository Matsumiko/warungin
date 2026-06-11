# PROJECT.md

Persistent project memory for agents and developers.

Keep this file compact, durable, and project-specific. Do not use it for task logs, active plans, changelog entries, or one-off notes.

Agents may update this file only with verified reusable project facts.

---

## Commands

```bash
# Install dependencies
bun install

# Start development
bun run dev

# Build
bun run build

# Lint
bun run lint

# Format
bun run format

# Test (watch mode)
bun run test

# Test (single run)
bun run test:run

# Set up/migrate Turso schema
bun run db:setup
```

---

## Architecture

**Project name:** warungin
**Type:** POS web app
**Primary language(s):** TypeScript
**Primary framework(s):** React 19, TanStack Start, TanStack Router, Vite, Tailwind CSS v4
**Database:** Turso/libSQL for tenant-scoped catalog and backoffice business data loaders
**Auth system:** tenant registration/login with scrypt password hashes, role-aware home routing, Turso-backed sessions, HttpOnly `warungin_session` cookie, dual-key rate limiting, account lockout, PIN-based cashier login, password reset with SHA-256 tokens, and hourly session cleanup
**Deployment target:** not configured; TanStack Start builds through Vite/Nitro
**Version control:** local Git repository initialized on `main`; remote `origin` points to `https://github.com/Matsumiko/warungin.git`

Key boundaries:

- Routing is file-based under `src/routes`; generated route tree lives at `src/routeTree.gen.ts`.
- Vite config uses official plugins directly: `@tanstack/react-start/plugin/vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, and `vite-tsconfig-paths`.
- The app has a custom server entry at `src/server.ts` for SSR error normalization; keep `tanstackStart({ server: { entry: "server" } })` in `vite.config.ts`.
- Shared UI primitives live under `src/components/ui` and follow shadcn/Radix-style component patterns.
- Runtime business data and tenant settings come from Turso server functions; Turso schema/setup lives under `src/lib/db/` and `scripts/db-setup.ts`.
- Auth pure functions (role checks, path guards, normalizeRole, etc.) live in `src/lib/auth-utils.ts` — safe for client and server bundles. Auth server functions (login, session, createServerFn wrappers) live in `src/lib/auth.ts` — server-only. Route files import pure functions from `auth-utils.ts` and server functions from `auth.ts`.
- Rate limiting and account lockout live in `src/lib/rate-limit.ts`; use `checkLoginRateLimit(ip, email)` for login, `checkRateLimit(key, limit, windowMs)` for general endpoints, and `isAccountLocked`/`recordFailedLogin`/`clearFailedLogins` for lockout state.
- Security headers middleware lives in `src/start.ts`; it runs on every request and adds standard security headers plus HSTS in production.
- Role access rules live in `src/lib/auth.ts`; route guards, sidebar visibility, login redirects, and sensitive server mutations should use those shared helpers instead of duplicating ad hoc role checks.
- Backoffice business loaders live in `src/lib/backoffice.ts` and must filter by `tenant_id` from `requireAuthSession()`.
- Tenant-scoped writes currently exist for categories, products, product variants, suppliers, customers, customer delete, outlets, outlet soft-delete, expenses, app users, promotions, tenant settings, outlet stock-transfer requests, shift open/close reports, device pairing requests/logout, logout/session deletion, cashier checkout transactions, inventory stock adjustments, import/export audit logs, product CSV import/upsert, stock CSV import, purchase order drafts/status updates, purchase order item receiving into product stock, PIN-based login, PIN management, and password reset. Checkout writes `transactions` and `transaction_items`, decrements product stock, applies tenant tax/service settings, and reports aggregate from `transactions`. Sensitive settings/users/devices/audit/import-export/catalog/checkout/shift mutations include role checks.
- Product SKU uniqueness is tenant-scoped with a unique index on `(tenant_id, sku)`; different tenants may use the same SKU.
- Shared catalog types live in `src/lib/catalog.types.ts`; currency/number formatters live in `src/lib/format.ts`.
- Routes may import `createServerFn` wrappers such as `src/lib/catalog.ts`, `src/lib/backoffice.ts`, and `src/lib/auth.ts`, but direct database clients stay behind server-only modules such as `src/lib/db/turso.server.ts`.

---

## Important Paths

```text
/
|-- src/routes/        - TanStack Router file routes and app pages
|-- src/components/    - App shell and reusable UI components
|-- src/lib/           - Utilities, catalog loader/types, database helpers, formatters, and SSR error helpers
|-- scripts/           - Project utility scripts such as Turso schema setup
|-- src/styles.css     - Tailwind v4 entrypoint and design tokens
|-- vite.config.ts     - Official TanStack Start/Vite plugin setup
|-- package.json       - Bun scripts and dependency manifest
`-- bun.lock           - Bun lockfile
```

---

## Environment

Do not store real secret values here.

| Variable         | Required                        | Purpose                   | Where to get it                |
| ---------------- | ------------------------------- | ------------------------- | ------------------------------ |
| `TURSO_DB_URL`   | yes for catalog/database routes | Turso/libSQL database URL | Turso dashboard / local `.env` |
| `TURSO_DB_TOKEN` | yes for catalog/database routes | Turso/libSQL auth token   | Turso dashboard / local `.env` |

---

## Testing

- Unit tests: rate-limit (15), auth helpers (38), csrf (3), backoffice-utils (45) — 101 tests via Vitest.
- Integration tests: auth flows (9), backoffice shift+CRUD+transactions+PO (30) — 39 tests via Vitest with mocked DB.
- Migration tests: 9 tests verifying schema, idempotency, and column presence via in-memory SQLite.
- Total: 179 tests passing across 11 test files.
- Lint: `bun run lint` passes with 0 errors; it currently reports 6 Fast Refresh warnings in shadcn-style UI primitive files.
- Typecheck: `bunx tsc --noEmit`.
- Build: `bun run build`.
- Security audit: `bun audit` passes; `package.json` pins `brace-expansion` to `5.0.6` via `overrides` for a transitive advisory.
- Test data requirements: authenticated route tests need a registered tenant/user; new tenants intentionally see empty business data until records are created for that tenant.
- Services required before database-backed route tests: Turso credentials in `.env`, then run `bun run db:setup`.
- Cashier checkout, latest customer display, and print receipt use persisted tenant tax/service settings; schema setup must include `transactions.service_charge`.

---

## CI/CD & Docker

- **Dockerfile**: Multi-stage build. `oven/bun:1-slim` for build + runtime. Build stage: `bun install --frozen-lockfile` + `bun run build`. Runtime stage: copies `dist/`, `node_modules/`, `package.json`.
- **Start command**: `bun run start` → `bun run srvx` (srvx CLI auto-detects `dist/server/server.js`).
- **Port**: 3000.
- **Runtime env vars**: `TURSO_DB_URL`, `TURSO_DB_TOKEN`, `NODE_ENV=production`.
- **Health check**: `GET /api/health`.
- **.dockerignore**: Excludes `node_modules`, `dist`, `.git`, `.env`, tests, config files, and markdown docs. Keeps `tsconfig.json` (needed by `tsconfigPaths()` Vite plugin).
- **CI workflow**: `.github/workflows/ci.yml` — 3 jobs:
  - `ci`: `bunx tsc --noEmit` → `bun run lint` → `bun run test:run`
  - `build`: `bun run build` (depends on `ci`)
  - `docker`: `docker build` + health check verification (depends on `build`, main branch only)
- **GitHub Actions runner**: `ubuntu-latest`, uses `oven-sh/setup-bun@v2`.

---

## Database Migrations

- **Runner**: `src/lib/db/migrate.ts` — lightweight migration runner with `_migrations` tracking table.
- **Registry**: `src/lib/db/migrations/index.ts` — 12 numbered migrations (001-012) covering auth, transactions, shifts, stock, notifications, sessions, and customer loyalty.
- **Testing**: `src/lib/db/migrate.test.ts` — 9 tests verifying all migrations run, idempotency, schema correctness, and tenant_id presence.
- **Entry point**: `scripts/db-setup.ts` — runs `schemaStatements` (CREATE TABLE IF NOT EXISTS) then `runMigrations()`.
- **Tracking**: `_migrations` table stores applied migration names and timestamps. Already-applied migrations are skipped.
- **No rollback**: Turso/libSQL doesn't support DDL transactions. Rollbacks are manual.

## Structured Logger

- **Logger**: `src/lib/logger.ts` — JSON in production, human-readable in dev. Levels: debug, info, warn, error.
- **Integration**: `src/server.ts` and `src/start.ts` use `logger.error()` instead of `console.error`.
- Import/export tests should use a registered tenant, then verify product CSV import creates/updates products, stock CSV import updates product stock and stock history, and product export downloads a real file.
- Multi-tenant SKU regression tests should verify two independently registered tenants can create/import the same SKU while duplicate SKU within one tenant is rejected or updated intentionally.

---

## Known Gotchas

### AI-builder dependency removal

**Problem:** The original scaffold used a builder-specific Vite wrapper, which pulled extra builder plugins and taggers.
**Why it happens:** The bundled config wrapped the official TanStack/Vite plugins and injected builder-specific behavior.
**How to avoid:** Keep `vite.config.ts` on official Vite/TanStack plugins. Do not re-add builder-specific Vite wrappers, taggers, or browser event bridges unless explicitly requested.

### Lint has non-blocking Fast Refresh warnings

**Problem:** `bun run lint` exits successfully but reports warnings in several `src/components/ui/*` files.
**Why it happens:** shadcn/Radix-style files export component helpers such as variants or hooks alongside components, which triggers `react-refresh/only-export-components`.
**How to avoid:** Treat these as non-blocking unless Fast Refresh behavior becomes a developer-experience issue. Fix by moving helper exports to adjacent files, not by suppressing unrelated lint checks.

### TanStack Start server import protection

**Problem:** Route files are client-visible and cannot directly import `*.server.ts` modules.
**Why it happens:** TanStack Start's import-protection plugin rejects server-only modules from the client graph during build.
**How to avoid:** Put route-safe `createServerFn` exports in non-`.server.ts` modules, and import server-only database clients dynamically inside the server function handler.

### Tenant-scoped data is mandatory

**Problem:** The original AI-builder UI used shared local arrays that looked like app data but did not belong to any registered user.
**Why it happens:** Static fixtures bypass auth and can leak or misrepresent data once real tenants exist.
**How to avoid:** Do not reintroduce shared mock business records in React routes. Business lists, reports, receipts, devices, notifications, users, customers, suppliers, outlets, products, inventory, expenses, and purchase orders must load through Turso server functions scoped by the authenticated tenant. UI option lists such as tabs or payment method choices may remain static when they are configuration choices rather than persisted records.

### Inline form submit handlers

**Problem:** React `event.currentTarget` can be null after an awaited server function in an async submit handler.
**Why it happens:** The event object should not be treated as stable across async boundaries for DOM operations such as `reset()`.
**How to avoid:** Capture `const formEl = e.currentTarget` before the first `await`, then use `new FormData(formEl)` and `formEl.reset()` after the server mutation resolves.

---

## Do Not Touch

- `.runbook/sessions/*.json` unless following the RunBook runtime session protocol.
- Ignored build output such as `dist/`, `.tanstack/`, `.output/`, `.vinxi/`, and `node_modules/`.
