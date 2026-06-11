import { createFileRoute } from "@tanstack/react-router";
import { getProfitReport } from "@/lib/backoffice";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/_app/reports/profit")({
  loader: () => getProfitReport(),
  component: ProfitReport,
});

function ProfitReport() {
  const { revenue, cogs, opex, gross, net } = Route.useLoaderData();
  const margin = revenue ? (net / revenue) * 100 : 0;
  return (
    <div className="grid sm:grid-cols-2 gap-6">
      <div className="space-y-3">
        <Row label="Pendapatan" value={formatIDR(revenue)} />
        <Row label="HPP" value={`- ${formatIDR(cogs)}`} />
        <div className="border-t border-border" />
        <Row label="Laba Kotor" value={formatIDR(gross)} bold />
        <Row label="Biaya Operasional" value={`- ${formatIDR(opex)}`} />
        <div className="border-t border-border" />
        <Row label="Laba Bersih" value={formatIDR(net)} bold large />
      </div>
      <div className="rounded-xl bg-primary/10 p-6 grid place-items-center text-center">
        <div>
          <div className="text-xs text-muted-foreground">Margin Bersih</div>
          <div className="mt-2 font-display text-5xl font-bold text-primary">
            {margin.toFixed(1)}%
          </div>
          <div className="mt-2 text-xs text-muted-foreground">Dari data transaksi Turso</div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  large,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span
        className={`${bold ? "font-display font-bold" : ""} ${large ? "text-2xl text-primary" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
