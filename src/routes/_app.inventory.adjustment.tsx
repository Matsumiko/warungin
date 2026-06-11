import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { adjustProductStock, getCatalog } from "@/lib/catalog";
import { getOutlets } from "@/lib/backoffice";

export const Route = createFileRoute("/_app/inventory/adjustment")({
  loader: async () => {
    const [catalog, outlets] = await Promise.all([getCatalog(), getOutlets()]);
    return { ...catalog, outlets };
  },
  component: InventoryAdjustmentPage,
});

function InventoryAdjustmentPage() {
  const router = useRouter();
  const { products: initialProducts, outlets } = Route.useLoaderData();
  const adjustStock = useServerFn(adjustProductStock);
  const fetchCatalog = useServerFn(getCatalog);
  const [submitting, setSubmitting] = useState(false);
  const [outletId, setOutletId] = useState("");
  const [products, setProducts] = useState(initialProducts);

  async function handleOutletChange(value: string) {
    setOutletId(value);
    const result = await fetchCatalog({ data: value || undefined });
    setProducts(result.products);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const result = await adjustStock({
        data: {
          productId: String(form.get("productId") ?? ""),
          stock: Number(form.get("stock") ?? 0),
          note: String(form.get("note") ?? ""),
          outletId: outletId || undefined,
        },
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Stok berhasil disesuaikan");
      router.invalidate();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link
        to="/inventory"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke stok
      </Link>
      <h2 className="font-display text-2xl font-bold">Penyesuaian Stok</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Simpan hasil opname dan catat riwayat mutasi stok.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5 rounded-xl border border-border bg-card p-5"
      >
        {outlets.length > 1 && (
          <Field label="Outlet">
            <select
              value={outletId}
              onChange={(e) => handleOutletChange(e.target.value)}
              className={inputCls}
            >
              <option value="">Semua outlet (global)</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>
                  {outlet.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Produk *">
          <select name="productId" required className={inputCls}>
            <option value="">Pilih produk</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · stok sekarang {product.stock}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Stok Aktual *">
          <input name="stock" required type="number" min={0} className={inputCls} />
        </Field>
        <Field label="Catatan">
          <textarea name="note" rows={3} className={inputCls} />
        </Field>
        <button
          disabled={submitting || !products.length}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Menyimpan..." : "Simpan Penyesuaian"}
        </button>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
