import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createUser, getUsers } from "@/lib/backoffice";

export const Route = createFileRoute("/_app/users")({
  loader: () => getUsers(),
  component: UsersPage,
});

const roleColor: Record<string, string> = {
  owner: "bg-primary/15 text-primary",
  manager: "bg-warning/15 text-warning",
  kasir: "bg-success/15 text-success",
  gudang: "bg-accent text-accent-foreground",
  display: "bg-muted text-muted-foreground",
};

function UsersPage() {
  const router = useRouter();
  const users = Route.useLoaderData();
  const saveUser = useServerFn(createUser);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setSubmitting(true);
    try {
      const result = await saveUser({
        data: {
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
          role: String(form.get("role") ?? "kasir") as "manager" | "kasir" | "gudang" | "display",
        },
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("User berhasil dibuat");
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
          <h2 className="font-display text-2xl font-bold">User & Role</h2>
          <p className="mt-1 text-sm text-muted-foreground">{users.length} user terdaftar</p>
        </div>
        <button
          onClick={() => setShowForm((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Tambah User
        </button>
      </div>
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[1fr_1fr_160px_180px_auto]"
        >
          <input name="name" required placeholder="Nama user" className={inputCls} />
          <input
            name="email"
            type="email"
            required
            placeholder="email@toko.id"
            className={inputCls}
          />
          <select name="role" defaultValue="kasir" className={inputCls}>
            <option value="manager">Manager</option>
            <option value="kasir">Kasir</option>
            <option value="gudang">Gudang</option>
            <option value="display">Display</option>
          </select>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="Password awal"
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
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border hover:bg-accent/20">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-semibold">
                      {u.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    {u.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium uppercase ${roleColor[u.role]}`}
                  >
                    <Shield className="h-3 w-3" />
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${u.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                  >
                    {u.active ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
              </tr>
            ))}
            {!users.length && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Belum ada user di database.
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
