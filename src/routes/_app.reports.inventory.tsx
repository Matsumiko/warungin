import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getCatalog } from "@/lib/catalog";
import { getOutlets } from "@/lib/backoffice";

export const Route = createFileRoute("/_app/reports/inventory")({
  loader: async () => {
    const [catalog, outlets] = await Promise.all([getCatalog(), getOutlets()]);
    return { ...catalog, outlets };
  },
  component: InventoryReport,
});

function InventoryReport() {
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

  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
  const lowStock = products.filter((product) => product.stock <= product.minStock).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi label="Total SKU" value={products.length.toString()} />
          <Kpi label="Total Stok" value={totalStock.toString()} />
          <Kpi label="Stok Rendah" value={lowStock.toString()} />
        </div>
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
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-accent/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Produk</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3 text-right">Stok</th>
              <th className="px-4 py-3 text-right">Minimum</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const category = categories.find((item) => item.id === product.categoryId);
              const low = product.stock <= product.minStock;
              return (
                <tr key={product.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{product.name}</td>
                  <td className="px-4 py-3">{category?.name ?? "-"}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {product.stock} {product.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{product.minStock}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        low ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
                      }`}
                    >
                      {low ? "Rendah" : "Aman"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!products.length && (
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold">{value}</div>
    </div>
  );
}
