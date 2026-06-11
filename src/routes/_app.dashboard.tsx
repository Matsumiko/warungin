import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  ShoppingBag,
  AlertTriangle,
  Users as UsersIcon,
  Clock,
  type LucideIcon,
} from "lucide-react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { formatIDR, formatNumber } from "@/lib/format";
import { getCatalog } from "@/lib/catalog";
import { useTranslation } from "@/lib/i18n";
import {
  getPaymentBreakdown,
  getSalesReport,
  getUsers,
  getLowStockProducts,
  getTopSellingProducts,
  getSalesByHour,
} from "@/lib/backoffice";

export const Route = createFileRoute("/_app/dashboard")({
  loader: async () => {
    const [
      catalog,
      salesLast7Days,
      paymentBreakdown,
      users,
      lowStockProducts,
      topSellingProducts,
      salesByHour,
    ] = await Promise.all([
      getCatalog(),
      getSalesReport(),
      getPaymentBreakdown(),
      getUsers(),
      getLowStockProducts(),
      getTopSellingProducts(),
      getSalesByHour(),
    ]);

    return {
      ...catalog,
      salesLast7Days,
      paymentBreakdown,
      users,
      lowStockProducts,
      topSellingProducts,
      salesByHour,
    };
  },
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const {
    products,
    salesLast7Days,
    paymentBreakdown,
    users,
    lowStockProducts,
    topSellingProducts,
    salesByHour,
  } = Route.useLoaderData();

  useRealtimeEvents({
    onTransactionCompleted: (data) => {
      toast.success(`Transaksi: ${formatIDR(data.total)} via ${data.paymentMethod}`);
      router.invalidate();
    },
    onShiftOpened: (data) => toast.info(`Shift dibuka: ${data.cashierName}`),
    onShiftClosed: (data) => toast.info(`Shift ditutup: ${data.cashierName}`),
    onStockChanged: () => router.invalidate(),
  });

  const todaySales = salesLast7Days.at(-1)?.sales ?? 0;
  const yesterday = salesLast7Days.at(-2)?.sales ?? 0;
  const salesDelta = yesterday ? ((todaySales - yesterday) / yesterday) * 100 : undefined;
  const todayTx = salesLast7Days.at(-1)?.transactions ?? 0;
  const aov = todayTx ? todaySales / todayTx : 0;
  const activeCashiers = users.filter((user) => user.role === "kasir" && user.active);

  return (
    <div className="p-6 space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("dashboard.todaysSales")}
          value={formatIDR(todaySales)}
          delta={salesDelta}
          icon={Receipt}
        />
        <KpiCard
          label={t("dashboard.transactions")}
          value={formatNumber(todayTx)}
          icon={ShoppingBag}
        />
        <KpiCard label={t("dashboard.avgOrderValue")} value={formatIDR(aov)} icon={TrendingUp} />
        <KpiCard
          label={t("dashboard.criticalStock")}
          value={`${lowStockProducts.length} ${t("common.unit")}`}
          icon={AlertTriangle}
          accent="warning"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold">{t("dashboard.sales7Days")}</h3>
              <p className="text-xs text-muted-foreground">{t("dashboard.salesTrend")}</p>
            </div>
          </div>
          <div className="mt-4 h-64">
            {salesLast7Days.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesLast7Days}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="day" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={12}
                    tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}jt`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => formatIDR(v)}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "var(--color-primary)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                {t("dashboard.noSalesData")}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-display text-lg font-semibold">{t("dashboard.paymentMethods")}</h3>
          <p className="text-xs text-muted-foreground">{t("dashboard.paymentDistribution")}</p>
          <div className="mt-2 h-44">
            {paymentBreakdown.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    dataKey="value"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {paymentBreakdown.map((p, i) => (
                      <Cell key={i} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                {t("dashboard.noPaymentData")}
              </div>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            {paymentBreakdown.map((p) => (
              <div key={p.method} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />{" "}
                  {p.method}
                </span>
                <span className="font-medium">{p.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lower row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-display text-lg font-semibold">{t("dashboard.topProducts")}</h3>
          <p className="text-xs text-muted-foreground">{t("dashboard.topProductsDesc")}</p>
          <div className="mt-4 h-56">
            {topSellingProducts.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSellingProducts} layout="vertical" margin={{ left: 0 }}>
                  <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    width={110}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="qty" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                {t("common.noData")}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">
              {t("dashboard.criticalStockTitle")}
            </h3>
            <Link to="/inventory" className="text-xs text-primary hover:underline">
              {t("dashboard.viewAll")}
            </Link>
          </div>
          {lowStockProducts.length > 0 && (
            <div className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              {t("dashboard.estimatedRestockCost")}:{" "}
              {formatIDR(lowStockProducts.reduce((s, p) => s + p.suggestedReorderQty * p.cost, 0))}
            </div>
          )}
          <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
            {lowStockProducts.slice(0, 8).map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.sku}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-destructive">
                      {p.stock} {p.unit}
                    </div>
                    <div className="text-[10px] text-muted-foreground">min {p.minStock}</div>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                  {p.avgDailySales > 0 && (
                    <span>
                      {p.avgDailySales}/{t("time.daysAgo")}
                    </span>
                  )}
                  {p.supplierName && <span>Supplier: {p.supplierName}</span>}
                  <span className="font-medium text-primary">
                    {p.suggestedReorderQty} {p.unit}
                  </span>
                </div>
              </div>
            ))}
            {!lowStockProducts.length && (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                {t("dashboard.noCriticalStock")}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">{t("dashboard.activeCashiers")}</h3>
            <Link to="/reports/shifts" className="text-xs text-primary hover:underline">
              {t("dashboard.shiftReport")}
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {activeCashiers.map((u, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-accent/30 p-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground font-semibold">
                  {u.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{u.name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> Shift {i === 0 ? "4j 22m" : "1j 05m"}
                  </div>
                </div>
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              </div>
            ))}
            {!activeCashiers.length && (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                {t("dashboard.noActiveShift")}
              </div>
            )}
            <Link
              to="/users"
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <UsersIcon className="h-3.5 w-3.5" /> {t("dashboard.manageUsers")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  delta?: number;
  icon: LucideIcon;
  accent?: "warning";
}) {
  const { t } = useTranslation();
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div
          className={`grid h-8 w-8 place-items-center rounded-lg ${accent === "warning" ? "bg-warning/15 text-warning" : "bg-accent text-primary"}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 font-display text-2xl font-bold">{value}</div>
      {delta !== undefined && (
        <div
          className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${positive ? "text-success" : "text-destructive"}`}
        >
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(delta).toFixed(1)}% {t("dashboard.vsYesterday")}
        </div>
      )}
    </div>
  );
}
