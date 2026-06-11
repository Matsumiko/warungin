import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowLeftRight, Package, Send, CheckCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  createStockTransfer,
  getOutlets,
  getStockTransfers,
  approveStockTransfer,
} from "@/lib/backoffice";
import { getCatalog } from "@/lib/catalog";

export const Route = createFileRoute("/_app/outlets/$id/transfer")({
  loader: async ({ params }) => {
    const [outlets, catalog, transfers] = await Promise.all([
      getOutlets(),
      getCatalog({ data: params.id }),
      getStockTransfers(),
    ]);
    return { outlets, products: catalog.products, transfers };
  },
  component: OutletTransferPage,
});

function OutletTransferPage() {
  const { id } = Route.useParams();
  const { outlets, products, transfers } = Route.useLoaderData();
  const router = useRouter();
  const saveTransfer = useServerFn(createStockTransfer);
  const approveTransfer = useServerFn(approveStockTransfer);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const fromOutlet = outlets.find((outlet) => outlet.id === id);

  async function handleApprove(transferId: string) {
    setApproving(transferId);
    try {
      const result = await approveTransfer({ data: { transferId } });
      if (result.ok) {
        toast.success("Transfer berhasil dieksekusi.");
        router.invalidate();
      } else {
        toast.error(result.message);
      }
    } finally {
      setApproving(null);
    }
  }
  const destinationOutlets = outlets.filter((outlet) => outlet.id !== id);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setSubmitting(true);
    try {
      const result = await saveTransfer({
        data: {
          fromOutletId: id,
          toOutletId: String(form.get("toOutletId") ?? ""),
          productId: String(form.get("productId") ?? ""),
          qty: Number(form.get("qty") ?? 0),
          note: String(form.get("note") ?? ""),
        },
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Request transfer stok tersimpan");
      formEl.reset();
      await router.invalidate();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <Link
        to="/outlets"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke outlet
      </Link>

      <div>
        <h2 className="font-display text-2xl font-bold">
          Transfer Stok {fromOutlet ? `dari ${fromOutlet.name}` : ""}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Request transfer dicatat ke database untuk approval. Stok akan dipindahkan antar outlet
          setelah transfer disetujui.
        </p>
      </div>

      {!fromOutlet ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Outlet asal tidak ditemukan di database.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Outlet Tujuan">
              <select name="toOutletId" required className={inputCls}>
                <option value="">Pilih outlet tujuan</option>
                {destinationOutlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Produk">
              <select name="productId" required className={inputCls}>
                <option value="">Pilih produk</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · stok {product.stock}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Qty">
              <input name="qty" type="number" min={1} required className={inputCls} />
            </Field>
            <Field label="Catatan">
              <input name="note" placeholder="Opsional" className={inputCls} />
            </Field>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              disabled={submitting || destinationOutlets.length === 0 || products.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {submitting ? "Menyimpan..." : "Kirim Request"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <ArrowLeftRight className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold">Riwayat Request Transfer</h3>
        </div>
        <div className="divide-y divide-border">
          {transfers.map((transfer) => (
            <div key={transfer.id} className="flex items-start gap-3 p-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
                <Package className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {transfer.productName} x{transfer.qty}
                </div>
                <div className="text-xs text-muted-foreground">
                  {transfer.fromOutlet} → {transfer.toOutlet} · {transfer.createdBy} ·{" "}
                  {transfer.createdAt}
                </div>
                {transfer.note && (
                  <div className="mt-1 text-xs text-muted-foreground">{transfer.note}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                  {transfer.status}
                </span>
                {transfer.status === "requested" && (
                  <button
                    onClick={() => handleApprove(transfer.id)}
                    disabled={approving === transfer.id}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <CheckCircle className="h-3 w-3" />
                    {approving === transfer.id ? "..." : "Setujui"}
                  </button>
                )}
              </div>
            </div>
          ))}
          {!transfers.length && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Belum ada request transfer stok di database.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary";
