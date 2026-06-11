import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { closeShift, getActiveShift } from "@/lib/backoffice";
import { getCurrentUser } from "@/lib/auth";
import { canAccessStandalonePath, roleHomePath } from "@/lib/auth-utils";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/cashier/shift/close")({
  head: () => ({ meta: [{ title: "Tutup Shift · Kasir" }] }),
  beforeLoad: async () => {
    const session = await getCurrentUser();
    if (!session) throw redirect({ to: "/login" });
    if (!canAccessStandalonePath(session.role, "/cashier")) {
      throw redirect({ to: roleHomePath(session.role) });
    }
  },
  loader: () => getActiveShift(),
  component: CloseShift,
});

function CloseShift() {
  const activeShift = Route.useLoaderData();
  const saveCloseShift = useServerFn(closeShift);
  const expected = activeShift?.expectedCash ?? 0;
  const [actual, setActual] = useState(expected);
  const [submitting, setSubmitting] = useState(false);
  const diff = actual - expected;
  const navigate = useNavigate();

  async function handleCloseShift() {
    if (!activeShift) return;
    setSubmitting(true);
    try {
      const result = await saveCloseShift({
        data: { shiftId: activeShift.id, actualCash: actual },
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Shift ditutup. Laporan tersimpan.");
      navigate({ to: "/dashboard" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7">
        <h1 className="font-display text-2xl font-bold">Tutup Shift</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {activeShift
            ? `${activeShift.kasir} · ${activeShift.outlet} · ${activeShift.open}`
            : "Belum ada shift aktif di database"}
        </p>

        <div className="mt-5 space-y-2 text-sm">
          <Row label="Modal Awal" value={formatIDR(activeShift?.openingCash ?? 0)} />
          <Row label="Penjualan Cash" value={formatIDR(activeShift?.cashSales ?? 0)} />
          <div className="border-t border-border my-2" />
          <Row label="Expected Cash" value={formatIDR(expected)} bold />
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium">Actual Cash (hitung fisik)</label>
          <input
            type="number"
            value={actual}
            onChange={(e) => setActual(Number(e.target.value))}
            className="mt-1.5 w-full rounded-lg border border-border bg-input/40 px-3 py-3 text-right text-xl font-bold outline-none focus:border-primary"
          />
        </div>

        <div
          className={`mt-4 rounded-lg p-3 text-center text-sm ${diff === 0 ? "bg-success/15 text-success" : diff > 0 ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`}
        >
          {diff === 0 ? "Cocok!" : `Selisih: ${diff > 0 ? "+" : ""}${formatIDR(diff)}`}
        </div>

        <div className="mt-6 flex gap-2">
          <Link
            to="/cashier"
            className="flex-1 rounded-lg border border-border py-2.5 text-center text-sm font-medium hover:bg-accent"
          >
            Batal
          </Link>
          <button
            onClick={handleCloseShift}
            disabled={!activeShift || submitting}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Menutup..." : "Tutup Shift"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-display font-bold" : ""}>{value}</span>
    </div>
  );
}
