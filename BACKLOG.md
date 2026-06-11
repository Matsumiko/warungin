# BACKLOG.md

Strategic backlog and future work for this project.

Use this file for work that is not currently being executed: ideas, tech debt,
future improvements, deferred follow-ups, and prioritization. Do not use it for
active task progress; use `.runbook/sessions/*.json` and, for large active work,
`ACTIVE-PLAN.md`.

---

## Priority Reference

| Priority | Meaning      |
| -------- | ------------ |
| `P0`     | Blocking     |
| `P1`     | High value   |
| `P2`     | Medium value |
| `P3`     | Nice to have |

---

## Active - P0

---

## Active - P1

- [x] **Real-time notifications** ✅ Done 2026-06-10 — Schema migration 010 added `is_read` + `type` columns. Server functions: `createNotification`, `markNotificationRead`, `markAllNotificationsRead`, `getUnreadNotificationCount`. Notifications page rewritten with filtering, mark-as-read, real-time SSE. Unread badge on topbar.
- [x] **Barcode scanner support di cashier** ✅ Done 2026-06-10 — `useBarcodeScanner` hook with timing heuristic (4-30 chars in <500ms = scanner). Auto-add to cart on exact barcode match, beep feedback via Web Audio API, visual scan result overlay.
- [x] **Receipt printer integration** ✅ Done 2026-06-10 — Paper size honored (58mm/80mm/A4). Feature toggles wired (logo, cashier, QR). Auto-print after checkout. Print CSS added. Customer display real-time via SSE.
- [x] **Low-stock alerts & auto-reorder suggestions** ✅ Done 2026-06-10 — `getLowStockProducts` with 30-day sales velocity calculation. Enhanced dashboard low-stock section with reorder suggestions and estimated cost. Inventory page alert banner. Quick Reorder button on PO creation page.

---

## Active - P2

- [x] **E2E testing** ✅ Partial 2026-06-11 — Fixed root causes: missing migrations (db:setup needed), form button onClick handler, text=Dashboard strict mode violation, register store name assertion. 5/6 auth tests pass consistently. Remaining flakiness is dev server timing.
- [x] **Unit tests for remaining modules** ✅ Done 2026-06-11 — Added format.test.ts (formatIDR, formatNumber), i18n.test.ts (translation, interpolation, fallback). Total 192 tests passing.
- [x] **Offline/PWA support** ✅ Done 2026-06-11 — manifest.json, service worker (cache-first assets, network-first API), SW registration in root, offline fallback.
- [x] **Multi-instance rate limiting** ✅ Done 2026-06-11 — Rate limit store abstraction (MemoryStore, RedisStore interface). Redis store file created with @upstash/redis. Auto-detect REDIS_URL env var.
- [ ] **Email delivery for password reset** — DEFERRED: User belum tentukan provider. Integrate Resend/SendGrid/Mailgun buat kirim password reset token via email.

---

## Active - P3

- [x] **Dark/light mode toggle** ✅ Done 2026-06-10 — Light theme CSS variables, useTheme hook with localStorage persistence, auto mode support, instant preview on settings change.
- [x] **Cashier keyboard shortcuts** ✅ Done 2026-06-10 — useKeyboardShortcuts hook (F1=search, F2=scanner, F3=hold, F4=void, F5=checkout, F9=recall, Escape=close). Visual hints on buttons.
- [x] **Multi-language support (i18n)** ✅ Done 2026-06-10 — Lightweight i18n system (useTranslation hook, LocaleContext), 180+ translation keys for id/en. Dashboard, sidebar, and settings fully translated. Settings page language selector wired.
- [x] **Mobile responsive optimization** ✅ Done 2026-06-10 — Mobile hamburger menu with Sheet drawer, sidebar nav extracted to shared component, auto-close on navigation.
- [x] **Dashboard analytics enhancements** ✅ Done 2026-06-10 — Fixed payment breakdown (today-only, distinct colors, percentages). Added top-selling products chart (30-day). Added hourly sales distribution chart.
- [x] **Customer loyalty program** ✅ Done 2026-06-10 — Migration 012 (customer_id on transactions). Points earning (1/10k spent), automatic level upgrades (Bronze→Platinum). Customer selector in cashier. Points redemption at checkout.

---

## Backlog - Under Consideration

- [ ] **Deployment config** — Deploy target belum configured. Setup Vercel/Railway/Fly.io atau Docker ke VPS.
- [x] **Database migrations testing** ✅ Done 2026-06-11 — 9 migration tests with in-memory SQLite. Tests cover: all migrations run, idempotency, schema correctness, column presence, individual migration safety.
- [x] **Secrets management** ✅ Done 2026-06-11 — Updated .dockerignore, Dockerfile with ENV comments + health check, PROJECT.md with correct migration count and test counts.
- [x] **Multi-device session management** ✅ Done 2026-06-10 — Migration 011 (user_agent, ip_address, last_seen_at). Server functions: getUserSessions, revokeSession, revokeAllOtherSessions. "Sesi Aktif" tab in Settings with device info, IP, last seen, revoke buttons.
- [x] **CSV import preview & validation** ✅ Done 2026-06-10 — validateImportCsv server function with per-row validation (products: name/sku/numeric checks; stock: SKU existence check). Preview UI with color-coded rows, summary badges, "Import baris yang valid" button.
- [x] **Stock-per-outlet ledgering** ✅ Done 2026-06-10 — Fixed critical product edit stock desync. Outlet filters on inventory index, inventory adjustment, inventory report, products list. Enriched stock audit logs with outlet name. Stock transfer approval flow with "Setujui" button.

---

## Blocked

---

## Done

- [x] **Real-time notifications** — 2026-06-10. Schema, server functions, UI rewrite, unread badge.
- [x] **Barcode scanner support** — 2026-06-10. Hook, cashier integration, beep feedback.
- [x] **Receipt printer integration** — 2026-06-10. Paper size, feature toggles, auto-print, print CSS, customer display real-time.
- [x] **Low-stock alerts & auto-reorder** — 2026-06-10. Server function with velocity, dashboard enhancement, inventory alerts, Quick Reorder on PO.
- [x] **Multi-device session management** — 2026-06-10. Migration 011, session metadata, getUserSessions/revokeSession/revokeAllOtherSessions, Settings "Sesi Aktif" tab.
- [x] **CSV import preview & validation** — 2026-06-10. validateImportCsv, per-row validation, preview UI with color-coded rows, skipRows support.
- [x] **Stock-per-outlet ledgering** — 2026-06-10. Fixed product edit desync, outlet filters on 4 pages, enriched audit logs, stock transfer approval.
- [x] **Dark/light mode toggle** — 2026-06-10. Light theme CSS, useTheme hook, localStorage persistence, settings preview.
- [x] **Cashier keyboard shortcuts** — 2026-06-10. F1-F9 shortcuts, Escape to close, visual hints on buttons.
- [x] **Multi-language (i18n)** — 2026-06-10. useTranslation hook, LocaleContext, 180+ keys for id/en, dashboard/sidebar/settings translated.
- [x] **Mobile responsive** — 2026-06-10. MobileSidebar with Sheet drawer, hamburger in topbar, SidebarNav shared component.
- [x] **Dashboard analytics** — 2026-06-10. Fixed payment breakdown (today, colors, %). Top selling products chart. Hourly sales chart.
- [x] **Customer loyalty** — 2026-06-10. Migration 012, customer_id on transactions, points earning, level upgrades, customer selector, points redemption.
- [x] **Database migration testing** — 2026-06-11. 9 tests with in-memory SQLite, idempotency, schema verification.
- [x] **Secrets management** — 2026-06-11. .dockerignore update, Dockerfile ENV + health check, PROJECT.md updates.

## Cancelled
