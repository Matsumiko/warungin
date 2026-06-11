import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { QrCode } from "lucide-react";
import { getLatestTransaction, getTenantSettings } from "@/lib/backoffice";
import { getCurrentUser } from "@/lib/auth";
import { canAccessStandalonePath, roleHomePath } from "@/lib/auth-utils";
import { formatIDR } from "@/lib/format";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

export const Route = createFileRoute("/customer-display")({
  head: () => ({ meta: [{ title: "Customer Display" }] }),
  beforeLoad: async () => {
    const session = await getCurrentUser();
    if (!session) throw redirect({ to: "/login" });
    if (!canAccessStandalonePath(session.role, "/customer-display")) {
      throw redirect({ to: roleHomePath(session.role) });
    }
  },
  loader: async () => {
    const [transaction, tenantSettings] = await Promise.all([
      getLatestTransaction(),
      getTenantSettings(),
    ]);
    return { transaction, tenantSettings };
  },
  component: CustomerDisplay,
});

function CustomerDisplay() {
  const router = useRouter();
  const { transaction, tenantSettings } = Route.useLoaderData();

  useRealtimeEvents({
    onTransactionCompleted: () => router.invalidate(),
  });
  const taxRate = Number(tenantSettings.settings.taxRate ?? 0);
  const serviceRate = Number(tenantSettings.settings.serviceCharge ?? 0);
  const inclusive = tenantSettings.settings.taxMode === "inclusive";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="border-b border-border bg-sidebar px-8 py-5 text-center">
        <div className="font-display text-2xl font-bold text-primary">Warungin</div>
        <div className="text-sm text-muted-foreground">Selamat berbelanja</div>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-8 p-8">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-xl font-bold mb-4">Detail Pesanan</h2>
          <div className="space-y-3">
            {transaction?.items.map((i, idx) => (
              <div key={idx} className="flex justify-between border-b border-border pb-2">
                <div>
                  <div className="font-medium">{i.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {i.qty} × {formatIDR(i.price)}
                  </div>
                </div>
                <div className="font-bold">{formatIDR(i.qty * i.price)}</div>
              </div>
            ))}
            {!transaction && (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Belum ada transaksi aktif.
              </div>
            )}
          </div>
          <div className="mt-6 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatIDR(transaction?.subtotal ?? 0)}</span>
            </div>
            {!!transaction?.tax && (
              <div className="flex justify-between text-muted-foreground">
                <span>{inclusive ? `PPN ${taxRate}% (incl.)` : `PPN ${taxRate}%`}</span>
                <span>{formatIDR(transaction.tax)}</span>
              </div>
            )}
            {!!transaction?.serviceCharge && (
              <div className="flex justify-between text-muted-foreground">
                <span>Service {serviceRate}%</span>
                <span>{formatIDR(transaction.serviceCharge)}</span>
              </div>
            )}
          </div>
          <div className="mt-4 rounded-xl bg-primary/15 p-5 flex items-baseline justify-between">
            <span className="font-display text-lg font-bold">TOTAL</span>
            <span className="font-display text-4xl font-bold text-primary">
              {formatIDR(transaction?.total ?? 0)}
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 grid place-items-center text-center">
          <div>
            <div className="grid h-64 w-64 mx-auto place-items-center rounded-2xl bg-white">
              <QrCode className="h-56 w-56 text-black" />
            </div>
            <div className="mt-4 font-display text-xl font-bold">Scan QRIS untuk Bayar</div>
            <div className="text-sm text-muted-foreground">Semua aplikasi e-wallet & bank</div>
          </div>
        </div>
      </div>
      <div className="border-t border-border bg-sidebar py-4 text-center text-sm text-muted-foreground">
        Terima kasih atas kunjungan Anda 🙏
      </div>
    </div>
  );
}
