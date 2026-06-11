import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { AppSidebar, AppTopbar } from "@/components/app-sidebar";
import { getCurrentUser } from "@/lib/auth";
import { canAccessAppPath, roleHomePath } from "@/lib/auth-utils";
import { getUnreadNotificationCount, getTenantSettings } from "@/lib/backoffice";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { LocaleContext, type Locale } from "@/lib/i18n";

const titles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/products": "Produk",
  "/products/new": "Tambah Produk",
  "/categories": "Kategori",
  "/inventory": "Stok",
  "/inventory/adjustment": "Penyesuaian Stok",
  "/inventory/history": "Riwayat Mutasi Stok",
  "/suppliers": "Supplier",
  "/suppliers/new": "Tambah Supplier",
  "/purchase-orders": "Purchase Order",
  "/purchase-orders/new": "Buat Purchase Order",
  "/customers": "Customer",
  "/promotions": "Promo & Voucher",
  "/expenses": "Pengeluaran",
  "/outlets": "Outlet",
  "/reports/sales": "Laporan Penjualan",
  "/reports/products": "Stok Produk",
  "/reports/inventory": "Laporan Stok",
  "/reports/shifts": "Laporan Shift",
  "/reports/profit": "Laporan Laba Rugi",
  "/reports/payments": "Laporan Pembayaran",
  "/users": "User & Role",
  "/audit-logs": "Audit Log",
  "/settings": "Pengaturan",
  "/notifications": "Notifikasi",
  "/devices": "Device & Pairing",
  "/import-export": "Import / Export Data",
};

function getTitle(path: string) {
  if (titles[path]) return titles[path];
  for (const key of Object.keys(titles)) {
    if (path.startsWith(key + "/")) return titles[key];
  }
  return "Warungin";
}

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const session = await getCurrentUser();
    if (!session) {
      throw redirect({ to: "/login" });
    }
    if (!canAccessAppPath(session.role, location.pathname)) {
      throw redirect({ to: roleHomePath(session.role) });
    }
    const [notifResult, settingsResult] = await Promise.all([
      getUnreadNotificationCount(),
      getTenantSettings(),
    ]);
    return {
      session,
      unreadCount: notifResult.count,
      theme: settingsResult.settings.theme ?? "dark-navy",
      locale: (settingsResult.settings.appLanguage ?? "id") as Locale,
    };
  },
  component: AppLayout,
});

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { session, unreadCount, theme, locale } = Route.useRouteContext();
  useTheme(theme as ThemeMode);
  return (
    <LocaleContext.Provider value={locale}>
      <div className="flex min-h-screen bg-background">
        <AppSidebar session={session} />
        <div className="flex flex-1 flex-col min-w-0">
          <AppTopbar title={getTitle(pathname)} session={session} unreadCount={unreadCount} />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </LocaleContext.Provider>
  );
}
