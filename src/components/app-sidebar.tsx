import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Package,
  Tag,
  Boxes,
  Truck,
  FileText,
  Users,
  Megaphone,
  Wallet,
  Store,
  BarChart3,
  ShieldCheck,
  Settings,
  ScrollText,
  Store as StoreIcon,
  LogOut,
  ShoppingCart,
  Monitor,
  Upload,
  Menu,
  Bell,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth";
import { canAccessAppPath, canAccessStandalonePath, type AuthSession } from "@/lib/auth-utils";
import { useTranslation } from "@/lib/i18n";
import { useState } from "react";

const groups = [
  {
    labelKey: "Utama",
    items: [
      { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
      { to: "/cashier", labelKey: "nav.cashier", icon: ShoppingCart, external: true },
    ],
  },
  {
    labelKey: "Katalog",
    items: [
      { to: "/products", labelKey: "nav.products", icon: Package },
      { to: "/categories", labelKey: "nav.categories", icon: Tag },
      { to: "/inventory", labelKey: "nav.inventory", icon: Boxes },
    ],
  },
  {
    labelKey: "Pembelian",
    items: [
      { to: "/suppliers", labelKey: "nav.suppliers", icon: Truck },
      { to: "/purchase-orders", labelKey: "nav.purchaseOrders", icon: FileText },
    ],
  },
  {
    labelKey: "Penjualan",
    items: [
      { to: "/customers", labelKey: "nav.customers", icon: Users },
      { to: "/promotions", labelKey: "nav.promotions", icon: Megaphone },
      { to: "/expenses", labelKey: "nav.expenses", icon: Wallet },
    ],
  },
  {
    labelKey: "Operasional",
    items: [
      { to: "/outlets", labelKey: "nav.outlets", icon: Store },
      { to: "/devices", labelKey: "nav.devices", icon: Monitor },
      { to: "/reports/sales", labelKey: "nav.reports", icon: BarChart3 },
      { to: "/import-export", labelKey: "nav.importExport", icon: Upload },
      { to: "/users", labelKey: "nav.users", icon: ShieldCheck },
      { to: "/audit-logs", labelKey: "nav.auditLogs", icon: ScrollText },
      { to: "/settings", labelKey: "nav.settings", icon: Settings },
    ],
  },
];

function getVisibleGroups(role: string) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.external ? canAccessStandalonePath(role, item.to) : canAccessAppPath(role, item.to),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

function SidebarNav({ session, onNavigate }: { session: AuthSession; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const logoutServer = useServerFn(logout);
  const visibleGroups = getVisibleGroups(session.role);
  const initials = session.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleLogout() {
    await logoutServer();
    navigate({ to: "/login" });
    onNavigate?.();
  }

  return (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <StoreIcon className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-sm font-bold">Warungin</div>
          <div className="text-[11px] text-muted-foreground">POS Indonesia</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {visibleGroups.map((g) => (
          <div key={g.labelKey}>
            <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {g.labelKey}
            </div>
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const active =
                  pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground font-semibold">
            {initials || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{session.name}</div>
            <div className="text-xs text-muted-foreground truncate">{session.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

export function AppSidebar({ session }: { session: AuthSession }) {
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarNav session={session} />
    </aside>
  );
}

export function MobileSidebar({ session }: { session: AuthSession }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="lg:hidden rounded-md p-2 hover:bg-accent" aria-label="Buka menu">
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-64 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border"
      >
        <SidebarNav session={session} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

export function AppTopbar({
  title,
  session,
  unreadCount = 0,
}: {
  title: string;
  session: AuthSession;
  unreadCount?: number;
}) {
  const navigate = useNavigate();
  const logoutServer = useServerFn(logout);
  const canOpenCashier = canAccessStandalonePath(session.role, "/cashier");

  async function handleLogout() {
    await logoutServer();
    navigate({ to: "/login" });
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card/40 px-4 lg:px-6 backdrop-blur">
      <div className="flex items-center gap-2">
        <MobileSidebar session={session} />
        <h1 className="font-display text-lg lg:text-xl font-bold">{title}</h1>
      </div>
      <div className="flex items-center gap-2 lg:gap-3">
        <Link to="/notifications" className="relative rounded-md p-2 hover:bg-accent">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
        <div className="hidden sm:block">
          <div className="max-w-36 truncate text-right text-sm font-medium">{session.name}</div>
          <div className="truncate text-right text-xs text-muted-foreground">{session.role}</div>
        </div>
        {canOpenCashier && (
          <Link
            to="/cashier"
            className="hidden sm:inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <ShoppingCart className="h-4 w-4" /> Buka Kasir
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Keluar"
          title="Keluar"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
