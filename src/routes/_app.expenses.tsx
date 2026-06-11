import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createExpense, getExpenses } from "@/lib/backoffice";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/_app/expenses")({
  loader: () => getExpenses(),
  component: ExpensesPage,
});

const catColor: Record<string, string> = {
  Listrik: "bg-warning/15 text-warning",
  Gaji: "bg-primary/15 text-primary",
  Operasional: "bg-accent text-accent-foreground",
  Sewa: "bg-destructive/15 text-destructive",
};

function ExpensesPage() {
  const router = useRouter();
  const expenses = Route.useLoaderData();
  const saveExpense = useServerFn(createExpense);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setSubmitting(true);
    try {
      await saveExpense({
        data: {
          expenseDate: String(form.get("expenseDate") ?? ""),
          category: String(form.get("category") ?? ""),
          note: String(form.get("note") ?? ""),
          amount: Number(form.get("amount") ?? 0),
        },
      });
      toast.success("Pengeluaran berhasil dicatat");
      formEl.reset();
      setShowForm(false);
      await router.invalidate();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Pengeluaran</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Total bulan ini:{" "}
            <span className="text-foreground font-semibold">{formatIDR(total)}</span>
          </p>
        </div>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Catat Pengeluaran
        </button>
      </div>
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[160px_180px_1fr_160px_auto]"
        >
          <input
            name="expenseDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={inputCls}
          />
          <input name="category" required placeholder="Kategori" className={inputCls} />
          <input name="note" placeholder="Keterangan" className={inputCls} />
          <input
            name="amount"
            type="number"
            min={0}
            required
            placeholder="Nominal"
            className={inputCls}
          />
          <button
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </button>
        </form>
      )}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-accent/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Keterangan</th>
              <th className="px-4 py-3 text-right">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e, i) => (
              <tr key={i} className="border-t border-border hover:bg-accent/20">
                <td className="px-4 py-3 text-muted-foreground">{e.date}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${catColor[e.category]}`}
                  >
                    {e.category}
                  </span>
                </td>
                <td className="px-4 py-3">{e.note}</td>
                <td className="px-4 py-3 text-right font-medium">{formatIDR(e.amount)}</td>
              </tr>
            ))}
            {!expenses.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Belum ada pengeluaran di database.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary";
