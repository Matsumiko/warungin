# FRONTEND.md

Frontend guidance for Warungin, a POS web app built with React, TanStack Start, TanStack Router, Vite, Tailwind CSS v4, Radix UI primitives, and lucide-react icons.

## Product Surface

Current user-facing surfaces are:

- Marketing/auth routes: `src/routes/index.tsx`, `src/routes/login.tsx`, `src/routes/register.tsx`, `src/routes/forgot-password.tsx`, `src/routes/reset-password.tsx`
- Public utility routes: `src/routes/api.health.tsx` (health check endpoint)
- POS workflow routes: `src/routes/cashier*.tsx`, `src/routes/customer-display.tsx`, `src/routes/print*.tsx`
- Backoffice routes under `src/routes/_app*.tsx` for dashboard, products, inventory, reports, suppliers, customers, settings, users, devices, and audit logs
- Shared shell/components in `src/components/` and `src/components/ui/`
- Authenticated app routes should render tenant/user data from the current session and Turso loaders, with honest empty states when the tenant has no records.
- Sidebar and topbar actions are role-aware; do not show hidden/unauthorized actions by copying raw nav arrays without `canAccessAppPath`/`canAccessStandalonePath`.
- Login page supports email/password and PIN modes with tabbed UI; forgot-password flow sends a token and redirects to reset-password page.

## Visual Direction

The current UI is a dark POS/backoffice product with Indonesian retail copy.

- Warungin is the web app/product brand. Demo merchant names such as `Toko Maju Bersama` represent tenant data and should not be renamed to the product brand.
- Palette is dark navy/slate with cyan primary, green success, yellow warning, red destructive, and chart accent colors from `src/styles.css`.
- Typography uses Inter for body text and Plus Jakarta Sans for headings.
- Layouts should feel operational: dense, scannable, and efficient for repeated cashier/backoffice use.
- Preserve the existing shadcn/Radix component style, 8-12px radius range, bordered dark surfaces, compact tables, and icon-led actions.
- Avoid marketing-heavy redesigns inside app/backoffice routes unless explicitly requested.

## Layout Rules

- App/backoffice routes should use the established app sidebar and page shell patterns.
- Use full-width work surfaces with constrained internal spacing; avoid nesting cards inside cards.
- Keep tables, counters, filters, and route tabs stable in size so dynamic data does not shift layout.
- Cashier screens should prioritize fast scanning, large primary transaction controls, and clear payment/receipt states.
- Cashier checkout dialogs must remain reachable on short desktop and mobile viewports; use scrollable overlays when modal content can exceed viewport height.
- Mobile layouts must wrap controls without text overlap.
- Do not use local business fixture arrays to fill empty screens. Empty-state copy is preferred until the matching Turso table/server function or mutation exists.
- Import/export controls should perform real file actions: templates can be generated client-side, but business exports/imports call server functions, download files through `Blob` URLs, upload CSV through file inputs, refresh route data, and show success/error toasts from actual results.

## Interaction Rules

- Use lucide-react icons for recognizable actions when available.
- Use existing Radix/shadcn primitives from `src/components/ui` before creating new UI primitives.
- Use tabs for route/view switching, dropdowns/menus for option sets, dialogs/sheets for focused tasks, and switches/checkboxes for binary settings.
- Preserve visible focus states and keyboard operability.
- Barcode scanner feedback: use green/red overlay strips for scan success/failure, Web Audio beep for auditory feedback.
- Notification filter pills: use rounded pill buttons with `bg-primary` for active, `bg-muted` for inactive.
- Unread notification items: left border accent (`border-l-2 border-l-primary`) + slight background tint.
- Receipt print: use `print-receipt` class for print targeting, `@media print` hides everything except receipt.
- Low-stock alert banner: use `border-warning/30 bg-warning/10` for warning banners with action buttons.

## Accessibility

- Maintain semantic headings in route content.
- Keep focus-visible states intact from the shared UI primitives.
- Do not communicate status by color alone; pair color with labels/icons.
- Keep contrast high on dark backgrounds, especially muted table text and destructive/warning states.

## Verification

For meaningful frontend changes, verify with:

- `bunx eslint <touched ts/tsx files>`
- `bunx tsc --noEmit`
- `bun run build`
- Manual responsive inspection when layout or interaction changes

`bun run lint` passes with 0 errors and 6 non-blocking Fast Refresh warnings in shadcn-style UI primitive files.
