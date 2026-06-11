import { createFileRoute } from "@tanstack/react-router";
import { getCatalog } from "@/lib/catalog";

export const Route = createFileRoute("/_app/reports/products")({
  loader: () => getCatalog(),
  component: ProductsReport,
});

function ProductsReport() {
  const { products } = Route.useLoaderData();
  const topProducts = products
    .filter((p) => p.active)
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 5)
    .map((p) => ({ name: p.name, qty: p.stock }));

  return (
    <div className="space-y-3">
      {topProducts.map((p, i) => (
        <div
          key={p.name}
          className="flex items-center gap-4 rounded-lg border border-border bg-background p-3"
        >
          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-primary font-bold">
            {i + 1}
          </div>
          <div className="flex-1">
            <div className="font-medium">{p.name}</div>
            <div className="h-1.5 rounded-full bg-accent mt-1 overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${(p.qty / topProducts[0].qty) * 100}%` }}
              />
            </div>
          </div>
          <div className="font-display font-bold">{p.qty} stok</div>
        </div>
      ))}
      {!topProducts.length && (
        <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
          Belum ada produk di database.
        </div>
      )}
    </div>
  );
}
