# BUG-HISTORY.md

Resolved bugs and regressions that future agents should learn from.

Use this only after a bug is understood or fixed. Active debugging belongs in the runtime session until the result is verified.

## How To Add A Bug

```markdown
## Short Bug Title

Date: 2026-06-05
Status: fixed

Problem:
What was wrong from the user's point of view.

Cause:
The root cause, not just the symptom.

Fix:
What changed.

Files changed:

- path/to/file.ts

Regression check:
The exact case, command, or assertion that should catch this bug if it returns.
```

## Fixed Bugs

## Roles Did Not Restrict App Access

Date: 2026-06-09
Status: fixed

Problem:
Users could be created with roles such as kasir, gudang, and display, but authenticated routes and navigation did not consistently restrict access by role.

Cause:
The session stored `role`, but `_app` only checked whether a session existed, the sidebar rendered every menu item, login always navigated to dashboard, and sensitive server mutations did not use role-aware authorization helpers.

Fix:
Added central role helpers, role home redirects, app and standalone route guards, role-aware sidebar/topbar filtering, login redirect to role home, and server-side role checks for settings, users, devices, audit logs, import/export, catalog writes, checkout, and shift operations.

Files changed:

- `src/lib/auth.ts`
- `src/components/app-sidebar.tsx`
- `src/routes/_app.tsx`
- `src/routes/login.tsx`
- `src/routes/cashier.index.tsx`
- `src/routes/cashier.shift.open.tsx`
- `src/routes/cashier.shift.close.tsx`
- `src/routes/customer-display.tsx`
- `src/routes/print.receipt.$id.tsx`
- `src/lib/backoffice.ts`
- `src/lib/catalog.ts`

Regression check:
Playwright smoke creates kasir, gudang, and display users, verifies kasir lands on `/cashier` and is redirected away from `/users`, gudang lands on `/inventory` and is redirected away from `/cashier` while retaining `/import-export`, and display lands on `/customer-display` and is redirected away from `/dashboard`.

## Product SKU Was Globally Unique Across Tenants

Date: 2026-06-09
Status: fixed

Problem:
Different registered tenants could not reliably use the same product SKU, so imports or product creation could fail because another tenant already used that SKU.

Cause:
The original `products` schema declared `sku TEXT NOT NULL UNIQUE`, which made SKU uniqueness global instead of tenant-scoped.

Fix:
Changed the schema to remove global SKU uniqueness, added a unique `(tenant_id, sku)` index, added an idempotent `db:setup` migration that rebuilds old `products` tables when needed, and added tenant-scoped duplicate checks in product create/update.

Files changed:

- `src/lib/db/schema.ts`
- `scripts/db-setup.ts`
- `src/lib/catalog.ts`
- `src/lib/backoffice.ts`

Regression check:
Playwright smoke registers two separate tenants, imports a product CSV with `SAME-SKU-QA` into each tenant, and verifies each tenant sees its own product with the same SKU.

## Import Export Buttons Only Showed Toasts

Date: 2026-06-09
Status: fixed

Problem:
The Import & Export page showed export buttons, template downloads, upload drop zones, and activity history, but export/template clicks only showed fake success toasts and CSV upload did not write tenant data.

Cause:
The route had no server mutations for file export/import. Activity history read `audit_logs`, but the UI never created import/export audit entries.

Fix:
Added tenant-scoped export and import server functions, CSV parsing, product import/upsert, stock import updates with stock-adjustment history, audit log summaries, real Blob downloads, file input upload handling, and route invalidation after actions.

Files changed:

- `src/lib/backoffice.ts`
- `src/routes/_app.import-export.tsx`

Regression check:
Playwright smoke registers a fresh tenant, imports a product CSV, verifies the product appears in Products, exports products as CSV and receives a downloaded file, imports a stock CSV, and verifies the product stock updates to 14 pcs.

## Checkout And Receipts Used Hardcoded Tax

Date: 2026-06-09
Status: fixed

Problem:
Tenant tax settings persisted on the settings page, but cashier checkout, latest customer display, and print receipt still behaved like the old hardcoded PPN flow and did not apply service charge.

Cause:
Checkout and receipt surfaces did not load `tenant_settings`, and `transactions` had no stored service charge amount. The server transaction mutation also validated totals against client-submitted subtotal plus tax instead of recomputing tenant-specific totals.

Fix:
Added `transactions.service_charge`, loaded tenant settings for checkout/display/receipt routes, calculated tax and service charge from those settings, and recomputed expected totals server-side in `createTransaction` before saving.

Files changed:

- `src/lib/db/schema.ts`
- `scripts/db-setup.ts`
- `src/lib/backoffice.ts`
- `src/routes/cashier.index.tsx`
- `src/routes/customer-display.tsx`
- `src/routes/print.receipt.$id.tsx`

Regression check:
Playwright smoke registers a fresh tenant, sets PPN 10%, service 5%, and exclusive tax mode, sells a Rp 10.000 product, then verifies cashier, customer display, and print receipt all show subtotal Rp 10.000, PPN Rp 1.000, service Rp 500, and total Rp 11.500.

## Settings Page Did Not Persist Changes

Date: 2026-06-09
Status: fixed

Problem:
The settings page displayed many controls for store profile, tax, receipts, payments, printers, notifications, appearance, and security, but saving only showed a toast and all values reset after reload.

Cause:
The UI had no field names, no server mutation, and no tenant-scoped settings storage. Toggle controls also did not submit values with the form.

Fix:
Added tenant-scoped `tenant_settings` key-value storage, settings loader/update server functions with an allowlist, tenant name update support, named form fields, hidden toggle values, and route invalidation after save.

Files changed:

- `src/lib/db/schema.ts`
- `scripts/db-setup.ts`
- `src/lib/backoffice.ts`
- `src/routes/_app.settings.tsx`

Regression check:
Playwright smoke registers a fresh tenant, changes Toko settings and Pajak settings, reloads the page, and verifies the saved values persist.

## Purchase Order Receiving Did Not Affect Inventory

Date: 2026-06-08
Status: fixed

Problem:
Purchase orders could be created and marked received, but they did not store item rows and receiving a PO did not add product stock.

Cause:
The scaffold only persisted PO header fields (`supplier_name`, `order_date`, `status`, `total`) and the received action only updated status.

Fix:
Added `purchase_order_items`, changed PO creation to store tenant product items with server-calculated totals, added PO detail item loading, and added a receive mutation that increments product stock once while recording a stock-history audit entry.

Files changed:

- `src/lib/db/schema.ts`
- `scripts/db-setup.ts`
- `src/lib/backoffice.ts`
- `src/routes/_app.purchase-orders.new.tsx`
- `src/routes/_app.purchase-orders.$id.tsx`

Regression check:
Playwright smoke registers a fresh tenant, creates a category and product with stock 0, creates a PO for qty 7, receives it, verifies product stock becomes 7, and verifies inventory history shows the receipt.

## Customer And Outlet Delete Actions Were Missing

Date: 2026-06-08
Status: fixed

Problem:
Customer and outlet screens let users create and edit records, but there was no usable delete path for tenant-owned records.

Cause:
The Turso-backed create/update loaders existed, but delete server functions and UI delete actions had not been wired after replacing the original mock UI.

Fix:
Added tenant-scoped customer hard delete and outlet soft-delete functions, guarded outlet deletion when a shift is still open for that outlet, then wired customer row delete and outlet card delete actions.

Files changed:

- `src/lib/backoffice.ts`
- `src/routes/_app.customers.index.tsx`
- `src/routes/_app.outlets.index.tsx`

Regression check:
Playwright smoke registers a fresh tenant, creates a customer and outlet, deletes both through the UI, and verifies the list counts return to zero.

## Supplier And Promotion Management Was Read-Only

Date: 2026-06-08
Status: fixed

Problem:
Supplier cards exposed a non-functional detail action, and the promotion screen showed database rows without any way to create, edit, activate, deactivate, or delete them.

Cause:
The tenant tables existed, but the UI had not been wired to route-safe server mutations for supplier and promotion management.

Fix:
Added tenant-scoped supplier update/delete and promotion create/update/delete functions, then wired supplier inline edit/delete and promotion create/edit/toggle/delete controls.

Files changed:

- `src/lib/backoffice.ts`
- `src/routes/_app.suppliers.index.tsx`
- `src/routes/_app.promotions.tsx`

Regression check:
Playwright smoke registers a tenant, creates/edits/deletes a supplier, then creates/toggles/edits/deletes a promotion.

## Shift, Device, And PO Detail Actions Were Not Durable

Date: 2026-06-08
Status: fixed

Problem:
Shift open/close, purchase order detail actions, and device pairing/logout controls looked actionable but either only navigated/toasted or updated local browser state.

Cause:
The scaffold had UI controls without tenant-scoped server mutations for `shift_reports`, `purchase_orders`, and `devices`.

Fix:
Added Turso-backed open/close shift functions with opening/closing cash, purchase order status updates with audit logging, device pairing request creation, and device logout persistence. Wired the relevant routes to those server functions.

Files changed:

- `src/lib/backoffice.ts`
- `src/lib/db/schema.ts`
- `scripts/db-setup.ts`
- `src/routes/cashier.shift.open.tsx`
- `src/routes/cashier.shift.close.tsx`
- `src/routes/_app.purchase-orders.$id.tsx`
- `src/routes/_app.purchase-orders.index.tsx`
- `src/routes/_app.devices.tsx`

Regression check:
Playwright smoke registers a tenant, opens and closes a shift, verifies the shift report, creates a purchase order, updates it to received, creates a device pairing request, and verifies the device persists after reload.

## Backoffice Actions Had Buttons Without Durable Writes

Date: 2026-06-08
Status: fixed

Problem:
Several backoffice screens exposed actions that looked usable but did not persist real tenant data, including expense creation, user creation, outlet editing, customer detail editing, and outlet stock-transfer requests.

Cause:
The AI-builder scaffold had presentational buttons and placeholder detail pages without route-safe server functions and Turso tables behind those workflows.

Fix:
Added tenant-scoped server functions and UI wiring for customer detail/update, expense creation, user creation with scrypt password hashing, outlet update, and stock-transfer request persistence through `stock_transfers` plus audit logs.

Files changed:

- `src/lib/backoffice.ts`
- `src/lib/db/schema.ts`
- `scripts/db-setup.ts`
- `src/routes/_app.customers.$id.tsx`
- `src/routes/_app.expenses.tsx`
- `src/routes/_app.outlets.$id.transfer.tsx`
- `src/routes/_app.outlets.index.tsx`
- `src/routes/_app.users.tsx`

Regression check:
Playwright smoke registers a fresh tenant, creates and edits a customer, records an expense, creates a user, edits an outlet, submits a stock-transfer request, and verifies the transfer request appears after reload.

## Product And Inventory Actions Were UI-Only

Date: 2026-06-08
Status: fixed

Problem:
Core actions visible in the UI, including adding product variants, editing products, editing categories, stock adjustments, inventory history, and simple purchase order creation, either did nothing durable or only represented planned UI behavior.

Cause:
The AI-builder scaffold had forms and action affordances without tenant-scoped Turso mutations and loaders behind those screens.

Fix:
Added tenant-scoped server functions and schema support for product variants, product updates, category updates/deletes, inventory adjustments, stock-adjustment history, inventory stock reports, and simple purchase order draft creation.

Files changed:

- `src/lib/catalog.ts`
- `src/lib/catalog.types.ts`
- `src/lib/db/schema.ts`
- `scripts/db-setup.ts`
- `src/routes/_app.products.new.tsx`
- `src/routes/_app.products.$id.tsx`
- `src/routes/_app.products.index.tsx`
- `src/routes/_app.categories.tsx`
- `src/routes/_app.inventory.adjustment.tsx`
- `src/routes/_app.inventory.history.tsx`
- `src/routes/_app.purchase-orders.new.tsx`
- `src/routes/_app.reports.inventory.tsx`

Regression check:
Playwright smoke registers a fresh tenant, creates a category, creates a product with a variant, reloads and edits the product, edits category data, records an inventory adjustment, confirms inventory history/report reflect it, and creates a purchase order draft.

## Async Form Reset After Server Mutation

Date: 2026-06-08
Status: fixed

Problem:
Inline create forms could save data but then throw a client error after the server mutation, disrupting later interactions and smoke tests.

Cause:
The submit handlers accessed `e.currentTarget.reset()` after an `await`. In React, `currentTarget` should not be relied on across async boundaries.

Fix:
Capture `const formEl = e.currentTarget` before awaiting the server function, then use `formEl` for `FormData` and `reset()`.

Files changed:

- `src/routes/_app.categories.tsx`
- `src/routes/_app.customers.index.tsx`
- `src/routes/_app.outlets.index.tsx`

Regression check:
Playwright smoke test creates a category, customer, and outlet from inline forms without console-breaking submit errors.
