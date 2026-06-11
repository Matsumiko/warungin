import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createSupplier } from "@/lib/backoffice";

export const Route = createFileRoute("/_app/suppliers/new")({
  component: NewSupplierPage,
});

function NewSupplierPage() {
  const navigate = useNavigate();
  const saveSupplier = useServerFn(createSupplier);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await saveSupplier({
        data: {
          name: String(form.get("name") ?? ""),
          contact: String(form.get("contact") ?? ""),
          phone: String(form.get("phone") ?? ""),
        },
      });
      toast.success("Supplier berhasil disimpan");
      navigate({ to: "/suppliers" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link
        to="/suppliers"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke supplier
      </Link>
      <h2 className="font-display text-2xl font-bold">Tambah Supplier</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Data supplier tersimpan untuk tenant ini.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-5 rounded-xl border border-border bg-card p-5"
      >
        <Field label="Nama Supplier *">
          <input name="name" required className={inputCls} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kontak">
            <input name="contact" className={inputCls} />
          </Field>
          <Field label="No. HP">
            <input name="phone" className={inputCls} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Link
            to="/suppliers"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Batal
          </Link>
          <button
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
