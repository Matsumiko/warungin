import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Store, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { loginWithEmail, loginWithPin } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Masuk · Warungin" },
      { name: "description", content: "Masuk ke akun Warungin kamu." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const login = useServerFn(loginWithEmail);
  const loginPin = useServerFn(loginWithPin);
  const [mode, setMode] = useState<"email" | "pin">("email");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin() {
    setSubmitting(true);
    try {
      if (mode === "pin") {
        const result = await loginPin({ data: { pin } });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success("Berhasil masuk");
        navigate({ to: result.home });
      } else {
        const form = document.querySelector("form");
        if (!form) return;
        const formData = new FormData(form);
        const result = await login({
          data: {
            email: String(formData.get("email") ?? ""),
            password: String(formData.get("password") ?? ""),
          },
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success("Berhasil masuk");
        navigate({ to: result.home });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-sidebar relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <Link to="/" className="relative flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">Warungin</span>
        </Link>
        <div className="relative">
          <h2 className="font-display text-4xl font-bold leading-tight">
            "Sejak pakai Warungin, saya tahu persis berapa untung tiap hari."
          </h2>
          <div className="mt-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-accent font-semibold">
              PA
            </div>
            <div>
              <div className="font-semibold">Pak Andi</div>
              <div className="text-sm text-muted-foreground">Pemilik Toko Sembako</div>
            </div>
          </div>
        </div>
        <div className="relative text-xs text-muted-foreground">© 2026 Warungin</div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Store className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold">Warungin</span>
          </div>

          <h1 className="font-display text-3xl font-bold">Selamat datang kembali</h1>
          <p className="mt-2 text-sm text-muted-foreground">Masuk untuk lanjut mengelola tokomu.</p>

          <div className="mt-6 inline-flex rounded-lg border border-border bg-card p-1 text-sm">
            <button
              onClick={() => setMode("email")}
              className={`rounded-md px-4 py-1.5 ${mode === "email" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Owner / Manager
            </button>
            <button
              onClick={() => setMode("pin")}
              className={`rounded-md px-4 py-1.5 ${mode === "pin" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              PIN Kasir
            </button>
          </div>

          {mode === "email" ? (
            <form className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium">Email</label>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1.5 w-full rounded-lg border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Password</label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                    Lupa?
                  </Link>
                </div>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="mt-1.5 w-full rounded-lg border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={handleLogin}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Memproses..." : "Masuk"} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <form className="mt-6 space-y-4">
              <label className="text-sm font-medium">PIN Kasir (6 digit)</label>
              <input
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                placeholder="• • • • • •"
                className="w-full rounded-lg border border-border bg-input/40 px-3 py-4 text-center text-3xl tracking-[0.5em] outline-none focus:border-primary"
              />
              <button type="button" onClick={handleLogin} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
                Masuk Kasir
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Belum punya toko?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Daftar gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
