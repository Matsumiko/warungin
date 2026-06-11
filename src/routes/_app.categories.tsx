import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createCategory, deleteCategory, getCatalog, updateCategory } from "@/lib/catalog";

export const Route = createFileRoute("/_app/categories")({
  loader: () => getCatalog(),
  component: CategoriesPage,
});

function CategoriesPage() {
  const router = useRouter();
  const { categories, products } = Route.useLoaderData();
  const saveCategory = useServerFn(createCategory);
  const editCategory = useServerFn(updateCategory);
  const removeCategory = useServerFn(deleteCategory);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const formEl = document.querySelector("form");
    if (!formEl) return;
    const form = new FormData(formEl);
    setSubmitting(true);
    try {
      await saveCategory({
        data: {
          name: String(form.get("name") ?? ""),
          icon: String(form.get("icon") ?? ""),
          color: String(form.get("color") ?? ""),
        },
      });
      toast.success("Kategori berhasil disimpan");
      formEl.reset();
      setShowForm(false);
      router.invalidate();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await editCategory({
        data: {
          id,
          name: String(form.get("name") ?? ""),
          icon: String(form.get("icon") ?? ""),
          color: String(form.get("color") ?? ""),
        },
      });
      toast.success("Kategori berhasil diperbarui");
      setEditingId(null);
      router.invalidate();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const result = await removeCategory({ data: { id } });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success("Kategori dihapus");
    router.invalidate();
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Kategori</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola pengelompokan produk. Drag untuk mengatur urutan.
          </p>
        </div>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Tambah Kategori
        </button>
      </div>
      {showForm && (
        <form
          className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_96px_160px auto]"
        >
          <input name="name" required placeholder="Nama kategori" className={inputCls} />
          <input name="icon" placeholder="Ikon" defaultValue="🏷️" className={inputCls} />
          <input
            name="color"
            placeholder="Warna"
            defaultValue="var(--color-primary)"
            className={inputCls}
          />
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </button>
        </form>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map((c) => {
          const count = products.filter((p) => p.categoryId === c.id).length;
          return (
            <div
              key={c.id}
              className="group rounded-xl border border-border bg-card p-5 transition hover:border-primary/50"
            >
              {editingId === c.id ? (
                <form onSubmit={(event) => handleEdit(event, c.id)} className="space-y-3">
                  <input name="name" required defaultValue={c.name} className={inputCls} />
                  <div className="grid grid-cols-[72px_1fr] gap-2">
                    <input name="icon" defaultValue={c.icon} className={inputCls} />
                    <input name="color" defaultValue={c.color} className={inputCls} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="flex-1 rounded-md border border-border py-2 text-xs font-medium hover:bg-accent"
                    >
                      Batal
                    </button>
                    <button
                      disabled={submitting}
                      className="flex-1 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      Simpan
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div
                      className="grid h-12 w-12 place-items-center rounded-xl text-2xl"
                      style={{ background: `color-mix(in oklch, ${c.color} 25%, transparent)` }}
                    >
                      {c.icon}
                    </div>
                    <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => setEditingId(c.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        disabled={count > 0}
                        onClick={() => handleDelete(c.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 font-display text-lg font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{count} produk</div>
                </>
              )}
            </div>
          );
        })}
        {!categories.length && (
          <div className="col-span-full rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Belum ada kategori di database.
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary";
