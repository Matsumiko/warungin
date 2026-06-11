import { createFileRoute } from "@tanstack/react-router";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { getPaymentBreakdown } from "@/lib/backoffice";

export const Route = createFileRoute("/_app/reports/payments")({
  loader: () => getPaymentBreakdown(),
  component: PaymentsReport,
});

function PaymentsReport() {
  const paymentBreakdown = Route.useLoaderData();

  return (
    <div className="h-80">
      {paymentBreakdown.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={paymentBreakdown} dataKey="value" nameKey="method" outerRadius={120}>
              {paymentBreakdown.map((p, i) => (
                <Cell key={i} fill={p.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="grid h-full place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          Belum ada data pembayaran.
        </div>
      )}
    </div>
  );
}
