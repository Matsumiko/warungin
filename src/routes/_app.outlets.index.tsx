import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, MapPin, Phone, ArrowLeftRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createOutlet, deleteOutlet, getOutlets, updateOutlet } from "@/lib/backoffice";

export const Route = createFileRoute("/_app/outlets/")({
  loader: () => getOutlets(),
  component: OutletsList,
});

function OutletsList() {
  const router = useRouter();
  const outlets = Route.useLoaderData();
  const saveOutlet = useServerFn(createOutlet);
  const editOutlet = useServerFn(updateOutlet);
  const removeOutlet = useServerFn(deleteOutlet);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setSubmitting(true);
    try {
      await saveOutlet({
        data: {
          name: String(form.get("name") ?? ""),
          address: String(form.get("address") ?? ""),
          phone: String(form.get("phone") ?? ""),
        },
      });
      toast.success("Outlet berhasil disimpan");
      formEl.reset();
      setShowForm(false);
      await router.invalidate();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(outlet: { id: string; name: string }) {
    if (!window.confirm(`Hapus outlet ${outlet.name}?`)) return;
    setDeletingId(outlet.id);
    try {
      const result = await removeOutlet({ data: { id: outlet.id } });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Outlet berhasil dihapus");
      if (editingId === outlet.id) setEditingId(null);
      await router.invalidate();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await editOutlet({
        data: {
          id,
          name: String(form.get("name") ?? ""),
          address: String(form.get("address") ?? ""),
          phone: String(form.get("phone") ?? ""),
        },
      });
      toast.success("Outlet berhasil diperbarui");
      setEditingId(null);
      await router.invalidate();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Outlet & Cabang</h2>
          <p className="mt-1 text-sm text-muted-foreground">{outlets.length} outlet aktif</p>
        </div>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Tambah Outlet
        </button>
      </div>
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_1.4fr_180px_auto]"
        >
          <input name="name" required placeholder="Nama outlet" className={inputCls} />
          <input name="address" placeholder="Alamat" className={inputCls} />
          <input name="phone" placeholder="No. HP" className={inputCls} />
          <button
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </button>
        </form>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {outlets.map((o) => (
          <div key={o.id} className="rounded-xl border border-border bg-card p-5">
            {editingId === o.id ? (
              <form onSubmit={(e) => handleEdit(e, o.id)} className="space-y-3">
                <input name="name" required defaultValue={o.name} className={inputCls} />
                <input name="address" defaultValue={o.address} className={inputCls} />
                <input name="phone" defaultValue={o.phone} className={inputCls} />
                <div className="flex gap-2">
                  <button
                    disabled={submitting}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    Batal
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h3 className="font-display text-lg font-semibold">{o.name}</h3>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" /> {o.address}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" /> {o.phone}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    to="/outlets/$id/transfer"
                    params={{ id: o.id }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Transfer Stok
                  </Link>
                  <button
                    onClick={() => setEditingId(o.id)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(o)}
                    disabled={deletingId === o.id}
                    className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Hapus
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {!outlets.length && (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Belum ada outlet di database.
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary";
