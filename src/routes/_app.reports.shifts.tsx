import { createFileRoute } from "@tanstack/react-router";
import { getShiftReports } from "@/lib/backoffice";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/_app/reports/shifts")({
  loader: () => getShiftReports(),
  component: ShiftsReport,
});

function ShiftsReport() {
  const shifts = Route.useLoaderData();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="pb-3">Kasir</th>
            <th className="pb-3">Outlet</th>
            <th className="pb-3">Buka</th>
            <th className="pb-3">Tutup</th>
            <th className="pb-3 text-right">Penjualan</th>
            <th className="pb-3 text-right">Selisih Kas</th>
          </tr>
        </thead>
        <tbody>
          {shifts.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="py-3 font-medium">{r.kasir}</td>
              <td className="py-3 text-muted-foreground">{r.outlet}</td>
              <td className="py-3 text-muted-foreground">{r.open}</td>
              <td className="py-3 text-muted-foreground">{r.close}</td>
              <td className="py-3 text-right font-medium">{formatIDR(r.sales)}</td>
              <td
                className={`py-3 text-right font-medium ${r.diff < 0 ? "text-destructive" : r.diff > 0 ? "text-warning" : "text-success"}`}
              >
                {r.diff === 0 ? "Cocok" : formatIDR(r.diff)}
              </td>
            </tr>
          ))}
          {!shifts.length && (
            <tr>
              <td colSpan={6} className="py-8 text-center text-muted-foreground">
                Belum ada laporan shift di database.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
