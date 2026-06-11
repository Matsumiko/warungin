import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus, Trash2, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createPurchaseOrder, getSuppliers, getLowStockProducts } from "@/lib/backoffice";
import { getCatalog } from "@/lib/catalog";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/_app/purchase-orders/new")({
  loader: async () => {
    const [suppliers, catalog, lowStockProducts] = await Promise.all([
      getSuppliers(),
      getCatalog(),
      getLowStockProducts(),
    ]);
    return { suppliers, products: catalog.products, lowStockProducts };
  },
  component: NewPurchaseOrderPage,
});

function NewPurchaseOrderPage() {
  const navigate = useNavigate();
  const { suppliers, products, lowStockProducts } = Route.useLoaderData();
  const saveOrder = useServerFn(createPurchaseOrder);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<PurchaseOrderItemForm[]>([createEmptyItem()]);
  const total = items.reduce(
    (sum, item) => sum + Number(item.qty || 0) * Number(item.unitCost || 0),
    0,
  );

  function fillFromLowStock() {
    if (!lowStockProducts.length) {
      toast.info("Tidak ada produk dengan stok rendah.");
      return;
    }
    const filled: PurchaseOrderItemForm[] = lowStockProducts.map((p) => ({
      key: crypto.randomUUID(),
      productId: p.id,
      qty: String(p.suggestedReorderQty),
      unitCost: String(p.cost),
    }));
    setItems(filled);
    toast.success(`${filled.length} produk stok rendah ditambahkan ke PO.`);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const validItems = items
      .filter((item) => item.productId && Number(item.qty) > 0)
      .map((item) => ({
        productId: item.productId,
        qty: Number(item.qty),
        unitCost: Number(item.unitCost || 0),
      }));
    if (!validItems.length) {
      toast.error("Tambahkan minimal 1 item produk");
      return;
    }
    setSubmitting(true);
    try {
      const result = await saveOrder({
        data: {
          supplierName: String(form.get("supplierName") ?? ""),
          orderDate: String(form.get("orderDate") ?? ""),
          status: String(form.get("status") ?? "draft") as "draft" | "sent",
          items: validItems,
        },
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Purchase order berhasil dibuat");
      navigate({ to: "/purchase-orders" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link
        to="/purchase-orders"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke purchase order
      </Link>
      <h2 className="font-display text-2xl font-bold">Buat Purchase Order</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pilih produk dari katalog tenant ini agar penerimaan barang bisa menambah stok.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5 rounded-xl border border-border bg-card p-5"
      >
        <Field label="Supplier *">
          <input
            name="supplierName"
            required
            list="supplier-options"
            className={inputCls}
            placeholder="Pilih atau ketik supplier"
          />
          <datalist id="supplier-options">
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.name} />
            ))}
          </datalist>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal *">
            <input
              name="orderDate"
              required
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={inputCls}
            />
          </Field>
          <Field label="Status">
            <select name="status" defaultValue="draft" className={inputCls}>
              <option value="draft">Draft</option>
              <option value="sent">Dikirim</option>
            </select>
          </Field>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-medium">Item Barang *</label>
            <div className="flex items-center gap-2">
              {lowStockProducts.length > 0 && (
                <button
                  type="button"
                  onClick={fillFromLowStock}
                  className="inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning hover:bg-warning/20"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Isi dari Stok Rendah ({lowStockProducts.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setItems((current) => [...current, createEmptyItem()])}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah Item
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-accent/30 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Harga Beli</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                  <th className="px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.key} className="border-t border-border">
                    <td className="px-3 py-2">
                      <select
                        required
                        value={item.productId}
                        onChange={(event) => {
                          const product = products.find((p) => p.id === event.target.value);
                          updateItem(
                            index,
                            {
                              ...item,
                              productId: event.target.value,
                              unitCost: product ? String(product.cost) : item.unitCost,
                            },
                            setItems,
                          );
                        }}
                        className={inputCls}
                      >
                        <option value="">Pilih produk</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} · stok {product.stock}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        required
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(event) =>
                          updateItem(index, { ...item, qty: event.target.value }, setItems)
                        }
                        className={`${inputCls} text-right`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        required
                        type="number"
                        min={0}
                        value={item.unitCost}
                        onChange={(event) =>
                          updateItem(index, { ...item, unitCost: event.target.value }, setItems)
                        }
                        className={`${inputCls} text-right`}
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatIDR(Number(item.qty || 0) * Number(item.unitCost || 0))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setItems((current) =>
                            current.length === 1
                              ? [createEmptyItem()]
                              : current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10"
                        aria-label="Hapus item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td colSpan={3} className="px-3 py-3 text-right font-medium">
                    Total
                  </td>
                  <td className="px-3 py-3 text-right font-display font-bold text-primary">
                    {formatIDR(total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {!products.length && (
            <p className="text-sm text-warning">
              Belum ada produk aktif. Buat produk dulu sebelum membuat PO.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Link
            to="/purchase-orders"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Batal
          </Link>
          <button
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary";

type PurchaseOrderItemForm = {
  key: string;
  productId: string;
  qty: string;
  unitCost: string;
};

function createEmptyItem(): PurchaseOrderItemForm {
  return {
    key: crypto.randomUUID(),
    productId: "",
    qty: "1",
    unitCost: "0",
  };
}

function updateItem(
  index: number,
  next: PurchaseOrderItemForm,
  setItems: React.Dispatch<React.SetStateAction<PurchaseOrderItemForm[]>>,
) {
  setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? next : item)));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
