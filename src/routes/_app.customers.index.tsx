import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createCustomer, deleteCustomer, getCustomers } from "@/lib/backoffice";
import { formatIDR, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_app/customers/")({
  loader: () => getCustomers(),
  component: CustomersList,
});

const levelColor: Record<string, string> = {
  Bronze: "bg-amber-700/20 text-amber-500",
  Silver: "bg-zinc-400/20 text-zinc-300",
  Gold: "bg-yellow-500/20 text-yellow-400",
  Platinum: "bg-cyan-500/20 text-cyan-400",
};

function CustomersList() {
  const router = useRouter();
  const customers = Route.useLoaderData();
  const saveCustomer = useServerFn(createCustomer);
  const removeCustomer = useServerFn(deleteCustomer);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setSubmitting(true);
    try {
      await saveCustomer({
        data: {
          name: String(form.get("name") ?? ""),
          phone: String(form.get("phone") ?? ""),
        },
      });
      toast.success("Member berhasil disimpan");
      formEl.reset();
      setShowForm(false);
      await router.invalidate();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(customer: { id: string; name: string }) {
    if (!window.confirm(`Hapus member ${customer.name}?`)) return;
    setDeletingId(customer.id);
    try {
      const result = await removeCustomer({ data: { id: customer.id } });
      if (!result.ok) {
        toast.error("Member tidak ditemukan atau sudah dihapus");
        return;
      }
      toast.success("Member berhasil dihapus");
      await router.invalidate();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Customer / Member</h2>
          <p className="mt-1 text-sm text-muted-foreground">{customers.length} member terdaftar</p>
        </div>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Tambah Member
        </button>
      </div>
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_220px_auto]"
        >
          <input name="name" required placeholder="Nama member" className={inputCls} />
          <input name="phone" placeholder="No. HP" className={inputCls} />
          <button
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </button>
        </form>
      )}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Cari nama atau no HP…"
              className="w-full rounded-md border border-border bg-input/40 pl-10 pr-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-accent/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">HP</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3 text-right">Poin</th>
              <th className="px-4 py-3 text-right">Total Belanja</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-border hover:bg-accent/20">
                <td className="px-4 py-3">
                  <Link
                    to="/customers/$id"
                    params={{ id: c.id }}
                    className="font-medium hover:text-primary"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${levelColor[c.level]}`}
                  >
                    {c.level}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">{formatNumber(c.points)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatIDR(c.totalSpent)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(c)}
                    disabled={deletingId === c.id}
                    aria-label={`Hapus member ${c.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!customers.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Belum ada member di database.
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
