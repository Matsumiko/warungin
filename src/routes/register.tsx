import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Store, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { registerTenant } from "@/lib/auth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Daftar Toko Baru · Warungin" },
      { name: "description", content: "Buat akun toko baru di Warungin, gratis." },
    ],
  }),
  component: RegisterPage,
});

const plans = [
  { id: "warung", name: "Warung", price: "Gratis" },
  { id: "toko", name: "Toko", price: "Rp 199rb/bln" },
  { id: "bisnis", name: "Bisnis", price: "Rp 499rb/bln" },
];

function RegisterPage() {
  const navigate = useNavigate();
  const register = useServerFn(registerTenant);
  const [plan, setPlan] = useState("toko");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const form = document.querySelector("form");
      if (!form) throw new Error("Form not found");
      const formData = new FormData(form);
      const result = await register({
        data: {
          storeName: String(formData.get("storeName") ?? ""),
          ownerName: String(formData.get("ownerName") ?? ""),
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
          plan: plan as "warung" | "toko" | "bisnis",
        },
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Toko berhasil dibuat. Selamat datang!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[REGISTER] Error:", msg);
      setError(msg);
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 bg-grid">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card/90 p-8 backdrop-blur">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">Warungin</span>
        </Link>

        <h1 className="mt-6 font-display text-3xl font-bold">Buat toko baru</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Setup dalam 1 menit. Tanpa kartu kredit.
        </p>
        {error && (
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Nama Toko</label>
            <input
              name="storeName"
              required
              placeholder="Nama toko kamu"
              className="mt-1.5 w-full rounded-lg border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Nama Owner</label>
              <input
                name="ownerName"
                required
                placeholder="Nama kamu"
                className="mt-1.5 w-full rounded-lg border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="kamu@toko.id"
                className="mt-1.5 w-full rounded-lg border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-lg border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Pilih Plan</label>
            <div className="mt-2 grid sm:grid-cols-3 gap-2">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p.id)}
                  className={`relative rounded-lg border p-3 text-left text-sm transition ${
                    plan === p.id
                      ? "border-primary bg-accent"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  {plan === p.id && (
                    <Check className="absolute right-2 top-2 h-4 w-4 text-primary" />
                  )}
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.price}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Membuat toko..." : "Buat Toko"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
