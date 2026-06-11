import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { getStockMutations } from "@/lib/backoffice";

export const Route = createFileRoute("/_app/inventory/history")({
  loader: () => getStockMutations(),
  component: InventoryHistoryPage,
});

function InventoryHistoryPage() {
  const rows = Route.useLoaderData();
  return (
    <div className="p-6 space-y-5">
      <Link
        to="/inventory"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke stok
      </Link>
      <div>
        <h2 className="font-display text-2xl font-bold">Riwayat Mutasi Stok</h2>
        <p className="mt-1 text-sm text-muted-foreground">Riwayat penyesuaian stok dari Turso.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-accent/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Produk</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(row.occurred_at).toLocaleString("id-ID")}
                </td>
                <td className="px-4 py-3 font-medium">{row.target}</td>
                <td className="px-4 py-3">{row.user_name}</td>
                <td className="px-4 py-3">{row.detail}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Belum ada riwayat mutasi stok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
