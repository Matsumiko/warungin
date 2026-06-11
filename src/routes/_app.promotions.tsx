import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Edit3, Plus, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createPromotion, deletePromotion, getPromotions, updatePromotion } from "@/lib/backoffice";

export const Route = createFileRoute("/_app/promotions")({
  loader: () => getPromotions(),
  component: PromotionsPage,
});

function PromotionsPage() {
  const router = useRouter();
  const promos = Route.useLoaderData();
  const savePromotion = useServerFn(createPromotion);
  const editPromotion = useServerFn(updatePromotion);
  const removePromotion = useServerFn(deletePromotion);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setSubmitting(true);
    try {
      await savePromotion({
        data: {
          name: String(form.get("name") ?? ""),
          description: String(form.get("description") ?? ""),
          active: form.get("active") === "on",
        },
      });
      toast.success("Promo berhasil dibuat");
      formEl.reset();
      setShowForm(false);
      await router.invalidate();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await editPromotion({
        data: {
          id,
          name: String(form.get("name") ?? ""),
          description: String(form.get("description") ?? ""),
          active: form.get("active") === "on",
        },
      });
      toast.success("Promo berhasil diperbarui");
      setEditingId(null);
      await router.invalidate();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(promo: (typeof promos)[number]) {
    await editPromotion({
      data: {
        id: promo.id,
        name: promo.name,
        description: promo.description,
        active: !promo.active,
      },
    });
    toast.success(promo.active ? "Promo dinonaktifkan" : "Promo diaktifkan");
    await router.invalidate();
  }

  async function handleDelete(id: string) {
    await removePromotion({ data: { id } });
    toast.success("Promo dihapus");
    await router.invalidate();
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Promo & Voucher</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola diskon, BOGO, voucher, dan promo member.
          </p>
        </div>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Buat Promo
        </button>
      </div>
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_1.5fr_auto_auto]"
        >
          <input name="name" required placeholder="Nama promo" className={inputCls} />
          <input name="description" placeholder="Deskripsi promo" className={inputCls} />
          <label className="flex items-center gap-2 text-sm">
            <input name="active" type="checkbox" defaultChecked />
            Aktif
          </label>
          <button
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </button>
        </form>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {promos.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-border bg-card p-5 flex items-start gap-4"
          >
            {editingId === p.id ? (
              <form onSubmit={(event) => handleEdit(event, p.id)} className="flex-1 space-y-3">
                <input name="name" required defaultValue={p.name} className={inputCls} />
                <input name="description" defaultValue={p.description} className={inputCls} />
                <label className="flex items-center gap-2 text-sm">
                  <input name="active" type="checkbox" defaultChecked={p.active} />
                  Aktif
                </label>
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
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                  <Tag className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold">{p.name}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {p.active ? "aktif" : "nonaktif"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggle(p)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${p.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                  >
                    {p.active ? "On" : "Off"}
                  </button>
                  <button
                    onClick={() => setEditingId(p.id)}
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-primary"
                    aria-label={`Edit ${p.name}`}
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-destructive"
                    aria-label={`Hapus ${p.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {!promos.length && (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Belum ada promo di database.
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary";
