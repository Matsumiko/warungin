import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Edit3, Plus, Phone, Trash2, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteSupplier, getSuppliers, updateSupplier } from "@/lib/backoffice";
import { formatIDR } from "@/lib/format";

export const Route = createFileRoute("/_app/suppliers/")({
  loader: () => getSuppliers(),
  component: SuppliersList,
});

function SuppliersList() {
  const router = useRouter();
  const suppliers = Route.useLoaderData();
  const saveSupplier = useServerFn(updateSupplier);
  const removeSupplier = useServerFn(deleteSupplier);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleEdit(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await saveSupplier({
        data: {
          id,
          name: String(form.get("name") ?? ""),
          contact: String(form.get("contact") ?? ""),
          phone: String(form.get("phone") ?? ""),
        },
      });
      toast.success("Supplier berhasil diperbarui");
      setEditingId(null);
      await router.invalidate();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    const result = await removeSupplier({ data: { id, name } });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Supplier dihapus");
    await router.invalidate();
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Supplier</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {suppliers.length} supplier terdaftar
          </p>
        </div>
        <Link
          to="/suppliers/new"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Tambah Supplier
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {suppliers.map((s) => (
          <div
            key={s.id}
            className="rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition"
          >
            {editingId === s.id ? (
              <form onSubmit={(event) => handleEdit(event, s.id)} className="space-y-3">
                <input name="name" required defaultValue={s.name} className={inputCls} />
                <input name="contact" defaultValue={s.contact} className={inputCls} />
                <input name="phone" defaultValue={s.phone} className={inputCls} />
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
                <div className="flex items-start justify-between">
                  <div className="grid h-11 w-11 place-items-center rounded-lg bg-accent text-primary font-display font-bold">
                    {s.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  {s.debt > 0 && (
                    <span className="inline-flex rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">
                      Hutang {formatIDR(s.debt)}
                    </span>
                  )}
                </div>
                <div className="mt-4 font-display font-semibold">{s.name}</div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" /> {s.contact || "-"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> {s.phone || "-"}
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{s.products} produk</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingId(s.id)}
                      className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-primary"
                      aria-label={`Edit ${s.name}`}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-destructive"
                      aria-label={`Hapus ${s.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
        {!suppliers.length && (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Belum ada supplier di database.
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary";
