import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, Plus, Download, Upload, Filter, Edit3 } from "lucide-react";
import { getCatalog } from "@/lib/catalog";
import { getOutlets } from "@/lib/backoffice";
import { formatIDR, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_app/products/")({
  loader: async () => {
    const [catalog, outlets] = await Promise.all([getCatalog(), getOutlets()]);
    return { ...catalog, outlets };
  },
  component: ProductsList,
});

function ProductsList() {
  const loaderData = Route.useLoaderData();
  const { categories, outlets } = loaderData;
  const [products, setProducts] = useState(loaderData.products);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [outletId, setOutletId] = useState("");
  const fetchCatalog = useServerFn(getCatalog);

  async function handleOutletChange(value: string) {
    setOutletId(value);
    const result = await fetchCatalog({ data: value || undefined });
    setProducts(result.products);
  }

  const filtered = products.filter(
    (p) =>
      (!cat || p.categoryId === cat) &&
      (!search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())),
  );
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Produk</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(products.length)} produk total ·{" "}
            {products.filter((p) => !p.active).length} nonaktif
          </p>
        </div>
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">
            <Upload className="h-4 w-4" /> Import
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent">
            <Download className="h-4 w-4" /> Export
          </button>
          <Link
            to="/products/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Tambah Produk
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk atau SKU…"
              className="w-full rounded-md border border-border bg-input/40 pl-10 pr-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <select
            value={cat ?? ""}
            onChange={(e) => setCat(e.target.value || null)}
            className="rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none"
          >
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {outlets.length > 1 && (
            <select
              value={outletId}
              onChange={(e) => handleOutletChange(e.target.value)}
              className="rounded-md border border-border bg-input/40 px-3 py-2 text-sm outline-none"
            >
              <option value="">Semua outlet (global)</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <button className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">
            <Filter className="h-3.5 w-3.5" /> Filter
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" />
                </th>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 text-right">Harga Jual</th>
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const cat = categories.find((c) => c.id === p.categoryId);
                const low = p.stock <= p.minStock;
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-accent/20">
                    <td className="px-4 py-3">
                      <input type="checkbox" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-lg">
                          {cat?.icon}
                        </div>
                        <Link
                          to="/products/$id"
                          params={{ id: p.id }}
                          className="font-medium hover:text-primary"
                        >
                          {p.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.sku}</td>
                    <td className="px-4 py-3">{cat?.name}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatIDR(p.price)}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${low ? "text-destructive" : ""}`}
                    >
                      {p.stock} {p.unit}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                      >
                        {p.active ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/products/$id"
                        params={{ id: p.id }}
                        className="inline-flex rounded p-1 hover:bg-accent"
                        aria-label={`Edit ${p.name}`}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
