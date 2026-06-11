import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Store, ArrowRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { resetPassword } from "@/lib/auth";
import { z } from "zod";

const searchSchema = z.object({
  token: z.string().min(1),
});

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password · Warungin" },
      { name: "description", content: "Atur password baru untuk akun Warungin kamu." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => searchSchema.parse(search),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const reset = useServerFn(resetPassword);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (password !== confirm) {
      toast.error("Password tidak cocok.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password minimal 8 karakter.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await reset({
        data: { token, newPassword: password },
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("Password berhasil direset. Silakan masuk.");
      navigate({ to: "/login" });
    } finally {
      setSubmitting(false);
    }
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

        <h1 className="mt-6 font-display text-3xl font-bold">Reset password</h1>
        <p className="mt-1 text-sm text-muted-foreground">Masukkan password baru kamu.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Password Baru</label>
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
            <label className="text-sm font-medium">Konfirmasi Password</label>
            <input
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-lg border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Memproses..." : "Reset Password"} <ArrowRight className="h-4 w-4" />
          </button>
        </form>

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
