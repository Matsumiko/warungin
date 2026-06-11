import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Send, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  getPurchaseOrderDetail,
  receivePurchaseOrder,
  updatePurchaseOrderStatus,
} from "@/lib/backoffice";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/_app/purchase-orders/$id")({
  loader: ({ params }) => getPurchaseOrderDetail({ data: params.id }),
  component: PODetail,
});

function PODetail() {
  const router = useRouter();
  const order = Route.useLoaderData();
  const saveStatus = useServerFn(updatePurchaseOrderStatus);
  const receiveOrder = useServerFn(receivePurchaseOrder);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function handleStatus(status: "sent" | "received" | "cancelled") {
    if (!order) return;
    setSubmitting(status);
    try {
      const result = await saveStatus({ data: { id: order.id, status } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Status purchase order diperbarui");
      await router.invalidate();
    } finally {
      setSubmitting(null);
    }
  }

  async function handleReceive() {
    if (!order) return;
    if (!window.confirm("Terima barang dan tambahkan stok produk?")) return;
    setSubmitting("received");
    try {
      const result = await receiveOrder({ data: { id: order.id } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Barang diterima dan stok produk diperbarui");
      await router.invalidate();
    } finally {
      setSubmitting(null);
    }
  }

  if (!order) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <Link
          to="/purchase-orders"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Link>
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Purchase order tidak ditemukan di database.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <Link
        to="/purchase-orders"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">{order.id}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.supplier} · {order.date}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.status === "draft" && (
            <button
              onClick={() => handleStatus("sent")}
              disabled={!!submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-warning px-4 py-2 text-sm font-semibold text-warning-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {submitting === "sent" ? "Mengirim..." : "Kirim PO"}
            </button>
          )}
          {order.status !== "received" && order.status !== "cancelled" && (
            <button
              onClick={handleReceive}
              disabled={!!submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-semibold text-success-foreground hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />{" "}
              {submitting === "received" ? "Menyimpan..." : "Terima Barang"}
            </button>
          )}
          {order.status !== "received" && order.status !== "cancelled" && (
            <button
              onClick={() => handleStatus("cancelled")}
              disabled={!!submitting}
              className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />{" "}
              {submitting === "cancelled" ? "Membatalkan..." : "Batalkan"}
            </button>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="pb-2">Produk</th>
              <th className="pb-2 text-right">Qty</th>
              <th className="pb-2 text-right">Harga</th>
              <th className="pb-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="py-3">{item.productName}</td>
                <td className="py-3 text-right font-medium">{item.qty}</td>
                <td className="py-3 text-right">{formatIDR(item.unitCost)}</td>
                <td className="py-3 text-right font-medium">{formatIDR(item.subtotal)}</td>
              </tr>
            ))}
            {!order.items.length && (
              <tr className="border-t border-border">
                <td colSpan={4} className="py-8 text-center text-muted-foreground">
                  Detail item PO belum ada di database.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td colSpan={3} className="pt-3 text-right font-medium">
                Total
              </td>
              <td className="pt-3 text-right font-display font-bold text-primary">
                {formatIDR(order.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
