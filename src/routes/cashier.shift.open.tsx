import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Banknote } from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser } from "@/lib/auth";
import { canAccessStandalonePath, roleHomePath } from "@/lib/auth-utils";
import { getOutlets, openShift } from "@/lib/backoffice";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/cashier/shift/open")({
  head: () => ({ meta: [{ title: "Buka Shift · Kasir" }] }),
  beforeLoad: async () => {
    const session = await getCurrentUser();
    if (!session) throw redirect({ to: "/login" });
    if (!canAccessStandalonePath(session.role, "/cashier")) {
      throw redirect({ to: roleHomePath(session.role) });
    }
  },
  loader: () => getOutlets(),
  component: OpenShift,
});

function OpenShift() {
  const outlets = Route.useLoaderData();
  const saveShift = useServerFn(openShift);
  const [amount, setAmount] = useState(0);
  const [outletName, setOutletName] = useState(outlets[0]?.name ?? "Outlet Utama");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  async function handleOpenShift() {
    setSubmitting(true);
    try {
      const result = await saveShift({ data: { openingCash: amount, outletName } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(`Shift dibuka dengan modal ${formatIDR(amount)}`);
      navigate({ to: "/cashier" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent text-primary mb-4">
          <Banknote className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-bold">Buka Shift Kasir</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Masukkan jumlah modal awal di laci kas.
        </p>

        <div className="mt-6 space-y-3">
          <label className="text-sm font-medium">Modal Awal</label>
          <select
            value={outletName}
            onChange={(e) => setOutletName(e.target.value)}
            className="w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {outlets.length ? (
              outlets.map((outlet) => <option key={outlet.id}>{outlet.name}</option>)
            ) : (
              <option>Outlet Utama</option>
            )}
          </select>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-input/40 px-3 py-3 text-right text-2xl font-bold outline-none focus:border-primary"
          />
          <div className="grid grid-cols-3 gap-2">
            {[300000, 500000, 1000000].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                className="rounded-md border border-border py-2 text-xs hover:bg-accent"
              >
                {formatIDR(v)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Link
            to="/dashboard"
            className="flex-1 rounded-lg border border-border py-2.5 text-center text-sm font-medium hover:bg-accent"
          >
            Batal
          </Link>
          <button
            onClick={handleOpenShift}
            disabled={submitting}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Membuka..." : "Mulai Shift"}
          </button>
        </div>
      </div>
    </div>
  );
}
