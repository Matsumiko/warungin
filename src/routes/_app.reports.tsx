import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

const tabs = [
  { to: "/reports/sales", label: "Penjualan" },
  { to: "/reports/products", label: "Stok Produk" },
  { to: "/reports/inventory", label: "Stok" },
  { to: "/reports/shifts", label: "Shift" },
  { to: "/reports/profit", label: "Laba Rugi" },
  { to: "/reports/payments", label: "Pembayaran" },
];

export const Route = createFileRoute("/_app/reports")({
  component: ReportsLayout,
});

function ReportsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="p-6">
      <h2 className="font-display text-2xl font-bold">Laporan</h2>
      <p className="mt-1 text-sm text-muted-foreground">Pilih jenis laporan yang ingin dilihat.</p>
      <div className="mt-5 border-b border-border">
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => {
            const active = pathname === t.to;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`relative -mb-px rounded-t-md px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-card text-foreground border border-border border-b-card"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="rounded-b-xl rounded-tr-xl border border-border border-t-0 bg-card p-6 -mt-px">
        <Outlet />
      </div>
    </div>
  );
}
