import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { getPurchaseOrders } from "@/lib/backoffice";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/_app/purchase-orders/")({
  loader: () => getPurchaseOrders(),
  component: POList,
});

const statusStyle: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-warning/15 text-warning",
  ordered: "bg-warning/15 text-warning",
  received: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};
const statusLabel: Record<string, string> = {
  draft: "Draft",
  sent: "Dikirim",
  ordered: "Dipesan",
  received: "Diterima",
  cancelled: "Dibatalkan",
};

function POList() {
  const pos = Route.useLoaderData();

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Purchase Order</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pemesanan stok ke supplier</p>
        </div>
        <Link
          to="/purchase-orders/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Buat PO
        </Link>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-accent/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">No. PO</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {pos.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-accent/20">
                <td className="px-4 py-3 font-medium">{p.id}</td>
                <td className="px-4 py-3">{p.supplier}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.date}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[p.status]}`}
                  >
                    {statusLabel[p.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatIDR(p.total)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to="/purchase-orders/$id"
                    params={{ id: p.id }}
                    className="text-primary text-xs font-medium hover:underline"
                  >
                    Detail →
                  </Link>
                </td>
              </tr>
            ))}
            {!pos.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Belum ada purchase order di database.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
