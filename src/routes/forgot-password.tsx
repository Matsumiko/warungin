import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Store, ArrowRight, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { requestPasswordReset } from "@/lib/auth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Lupa Password · Warungin" },
      { name: "description", content: "Reset password akun Warungin kamu." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const requestReset = useServerFn(requestPasswordReset);
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      const result = await requestReset({
        data: { email: String(form.get("email") ?? "") },
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      setToken(result.token);
      toast.success("Token reset berhasil dibuat.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopy() {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 bg-grid">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/90 p-8 backdrop-blur">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">Warungin</span>
        </Link>

        <h1 className="mt-6 font-display text-3xl font-bold">Lupa password?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Masukkan email akun kamu. Kami akan kirimkan token reset.
        </p>

        {token ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-border bg-accent/50 p-4">
              <p className="text-sm font-medium text-accent-foreground">Token reset kamu:</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-3 py-2 text-sm font-mono break-all">
                  {token}
                </code>
                <button
                  onClick={handleCopy}
                  className="shrink-0 rounded-lg border border-border p-2 hover:bg-accent"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Di produksi, token ini akan dikirim via email. Salin token ini dan buka halaman
                reset password.
              </p>
            </div>
            <Link
              to="/reset-password"
              search={{ token }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Buka Halaman Reset <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
            <button
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Memproses..." : "Kirim Token Reset"} <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Ingat password?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Masuk
          </Link>
        </p>
      </div>
    </div>
  );
}
