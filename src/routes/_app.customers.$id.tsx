import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BadgePercent, Phone, Save, WalletCards } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getCustomerDetail, updateCustomer } from "@/lib/backoffice";
import { formatIDR, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_app/customers/$id")({
  loader: ({ params }) => getCustomerDetail({ data: params.id }),
  component: CustomerDetailPage,
});

const levelColor: Record<string, string> = {
  Bronze: "bg-amber-700/20 text-amber-500",
  Silver: "bg-zinc-400/20 text-zinc-300",
  Gold: "bg-yellow-500/20 text-yellow-400",
  Platinum: "bg-cyan-500/20 text-cyan-400",
};

function CustomerDetailPage() {
  const { id } = Route.useParams();
  const customer = Route.useLoaderData();
  const router = useRouter();
  const saveCustomer = useServerFn(updateCustomer);
  const [submitting, setSubmitting] = useState(false);

  if (!customer) {
    return (
      <div className="mx-auto max-w-4xl space-y-5 p-6">
        <BackLink />
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Customer tidak ditemukan di database.
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      await saveCustomer({
        data: {
          id,
          name: String(form.get("name") ?? ""),
          phone: String(form.get("phone") ?? ""),
          points: Number(form.get("points") ?? 0),
          level: String(form.get("level") ?? "Bronze") as "Bronze" | "Silver" | "Gold" | "Platinum",
        },
      });
      toast.success("Customer berhasil diperbarui");
      await router.invalidate();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold">{customer.name}</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-4 w-4" /> {customer.phone || "No. HP belum diisi"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${levelColor[customer.level]}`}
        >
          {customer.level}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Poin" value={formatNumber(customer.points)} icon={BadgePercent} />
        <Stat label="Total Belanja" value={formatIDR(customer.totalSpent)} icon={WalletCards} />
        <Stat label="ID Member" value={customer.id.slice(0, 12)} icon={Save} />
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama">
            <input name="name" required defaultValue={customer.name} className={inputCls} />
          </Field>
          <Field label="No. HP">
            <input name="phone" defaultValue={customer.phone} className={inputCls} />
          </Field>
          <Field label="Level">
            <select name="level" defaultValue={customer.level} className={inputCls}>
              <option>Bronze</option>
              <option>Silver</option>
              <option>Gold</option>
              <option>Platinum</option>
            </select>
          </Field>
          <Field label="Poin">
            <input
              name="points"
              type="number"
              min={0}
              defaultValue={customer.points}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {submitting ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/customers"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Kembali ke customer
    </Link>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof BadgePercent;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="font-display text-lg font-bold">{value}</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary";
