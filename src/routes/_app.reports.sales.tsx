import { createFileRoute } from "@tanstack/react-router";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Download } from "lucide-react";
import { getOutlets, getSalesReport } from "@/lib/backoffice";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/_app/reports/sales")({
  loader: async () => {
    const [salesLast7Days, outlets] = await Promise.all([getSalesReport(), getOutlets()]);
    return { salesLast7Days, outlets };
  },
  component: SalesReport,
});

function SalesReport() {
  const { salesLast7Days, outlets } = Route.useLoaderData();
  const total = salesLast7Days.reduce((s, d) => s + d.sales, 0);
  const tx = salesLast7Days.reduce((s, d) => s + d.transactions, 0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <input
            type="date"
            className="rounded-md border border-border bg-input/40 px-3 py-2 text-sm"
          />
          <input
            type="date"
            className="rounded-md border border-border bg-input/40 px-3 py-2 text-sm"
          />
          <select className="rounded-md border border-border bg-input/40 px-3 py-2 text-sm">
            <option>Semua Outlet</option>
            {outlets.map((outlet) => (
              <option key={outlet.id}>{outlet.name}</option>
            ))}
          </select>
          <select className="rounded-md border border-border bg-input/40 px-3 py-2 text-sm">
            <option>Semua Kasir</option>
          </select>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Kpi label="Total Penjualan" value={formatIDR(total)} />
        <Kpi label="Total Transaksi" value={tx.toString()} />
        <Kpi label="AOV" value={formatIDR(tx ? total / tx : 0)} />
      </div>

      <div className="h-72">
        {salesLast7Days.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesLast7Days}>
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
              <Bar dataKey="sales" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            Belum ada data transaksi.
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
