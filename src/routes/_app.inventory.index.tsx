import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, ShoppingCart } from "lucide-react";
import { getCatalog } from "@/lib/catalog";
import { getOutlets } from "@/lib/backoffice";
import { formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_app/inventory/")({
  loader: async () => {
    const [catalog, outlets] = await Promise.all([getCatalog(), getOutlets()]);
    return { ...catalog, outlets };
  },
  component: InventoryPage,
});

function InventoryPage() {
  const loaderData = Route.useLoaderData();
  const { categories, outlets } = loaderData;
  const [products, setProducts] = useState(loaderData.products);
  const [outletId, setOutletId] = useState("");
  const fetchCatalog = useServerFn(getCatalog);

  async function handleOutletChange(value: string) {
    setOutletId(value);
    const result = await fetchCatalog({ data: value || undefined });
    setProducts(result.products);
  }

  const sorted = [...products].sort((a, b) => a.stock - a.minStock - (b.stock - b.minStock));
  const critical = products.filter((p) => p.stock <= p.minStock).length;
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Stok</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(products.length)} produk ·{" "}
            <span className="text-destructive">{critical} di bawah minimum</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {outlets.length > 1 && (
            <select
              value={outletId}
              onChange={(e) => handleOutletChange(e.target.value)}
              className="rounded-md border border-border bg-input/40 px-3 py-2 text-sm"
            >
              <option value="">Semua outlet (global)</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <Link
            to="/inventory/history"
            className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            Riwayat Mutasi
          </Link>
          <Link
            to="/inventory/adjustment"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Stok Opname
          </Link>
        </div>
      </div>
      {critical > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-warning/30 bg-warning/10 px-5 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <span className="text-sm font-medium">{critical} produk di bawah stok minimum</span>
          </div>
          <Link
            to="/purchase-orders/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <ShoppingCart className="h-4 w-4" />
            Buat PO
          </Link>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-accent/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Produk</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3 text-right">Stok</th>
              <th className="px-4 py-3 text-right">Min</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const low = p.stock <= p.minStock;
              const cat = categories.find((c) => c.id === p.categoryId);
              return (
                <tr key={p.id} className="border-t border-border hover:bg-accent/20">
                  <td className="px-4 py-3 font-medium">
                    {p.name}
                    <div className="text-xs text-muted-foreground">{p.sku}</div>
                  </td>
                  <td className="px-4 py-3">{cat?.name}</td>
                  <td className={`px-4 py-3 text-right font-bold ${low ? "text-destructive" : ""}`}>
                    {p.stock} {p.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{p.minStock}</td>
                  <td className="px-4 py-3">
                    {p.stock === 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                        <AlertTriangle className="h-3 w-3" /> Habis
                      </span>
                    ) : low ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                        <AlertTriangle className="h-3 w-3" /> Rendah
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                        Aman
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Belum ada produk di database.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
