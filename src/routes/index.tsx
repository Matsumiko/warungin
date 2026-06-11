import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShoppingCart,
  BarChart3,
  Boxes,
  Users,
  Smartphone,
  Receipt,
  Zap,
  ShieldCheck,
  Globe,
  Check,
  ArrowRight,
  Store,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Warungin — POS Modern untuk Retail Indonesia" },
      {
        name: "description",
        content:
          "Kelola toko, kasir, stok, dan laporan dalam satu aplikasi. Dukung multi-outlet, QRIS, dan struk thermal.",
      },
      { property: "og:title", content: "Warungin — POS Modern untuk Retail Indonesia" },
      {
        property: "og:description",
        content: "Kelola toko, kasir, stok, dan laporan dalam satu aplikasi.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: ShoppingCart,
    title: "Kasir Super Cepat",
    desc: "Scan barcode, pilih produk, terima pembayaran dalam hitungan detik.",
  },
  {
    icon: Boxes,
    title: "Manajemen Stok",
    desc: "Stok real-time, alert minimum, mutasi antar outlet, dan opname mudah.",
  },
  {
    icon: BarChart3,
    title: "Laporan Lengkap",
    desc: "Penjualan, laba rugi, shift kasir, dan top produk — semua dalam satu klik.",
  },
  {
    icon: Users,
    title: "Member & Loyalty",
    desc: "Poin, level member, dan promo otomatis untuk pelanggan setia.",
  },
  {
    icon: Receipt,
    title: "Struk & QRIS",
    desc: "Cetak thermal 58/80mm dan terima pembayaran QRIS instan.",
  },
  {
    icon: ShieldCheck,
    title: "Role & Audit",
    desc: "Akses owner, manager, kasir, dan gudang dengan audit log lengkap.",
  },
];

const plans = [
  {
    name: "Warung",
    price: "Gratis",
    desc: "Untuk warung & UMKM mulai",
    features: ["1 outlet", "1 kasir", "Produk tanpa batas", "Laporan dasar"],
    cta: "Mulai Gratis",
    featured: false,
  },
  {
    name: "Toko",
    price: "Rp 199rb",
    per: "/bulan",
    desc: "Untuk toko berkembang",
    features: ["3 outlet", "5 kasir", "Member & promo", "Laporan lengkap", "Export CSV/PDF"],
    cta: "Coba 14 Hari",
    featured: true,
  },
  {
    name: "Bisnis",
    price: "Rp 499rb",
    per: "/bulan",
    desc: "Untuk jaringan retail",
    features: [
      "Outlet tanpa batas",
      "Kasir tanpa batas",
      "Multi gudang",
      "API & integrasi",
      "Priority support",
    ],
    cta: "Hubungi Sales",
    featured: false,
  },
];

const testimonials = [
  {
    name: "Pak Andi",
    role: "Pemilik Toko Sembako",
    quote: "Penjualan harian saya naik 30% sejak pakai Warungin. Laporannya sangat membantu.",
  },
  {
    name: "Bu Sari",
    role: "Owner Coffee Shop",
    quote: "Kasir saya bisa langsung pakai tanpa training. Interface-nya jelas dan cepat.",
  },
  {
    name: "Pak Hendra",
    role: "Manager Minimarket",
    quote: "Multi-outlet jadi mudah. Transfer stok dan laporan konsolidasi tinggal klik.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <header className="border-b border-border/60 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Store className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold">Warungin</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#fitur" className="hover:text-foreground">
              Fitur
            </a>
            <a href="#harga" className="hover:text-foreground">
              Harga
            </a>
            <a href="#testimoni" className="hover:text-foreground">
              Testimoni
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-md px-4 py-2 text-sm font-medium hover:bg-accent">
              Masuk
            </Link>
            <Link
              to="/register"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Daftar
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-20 lg:py-28 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span>Versi 2.0 — sekarang dengan QRIS & multi-outlet</span>
          </div>
          <h1 className="mt-6 text-balance font-display text-5xl font-bold leading-tight md:text-7xl">
            Kasir modern untuk <br /> <span className="text-gradient-brand">retail Indonesia</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            Satu aplikasi untuk kasir, stok, member, dan laporan. Dirancang untuk warung, toko, dan
            jaringan retail yang ingin tumbuh.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Mulai Gratis <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/cashier"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-6 py-3 text-sm font-semibold hover:bg-accent"
            >
              Lihat Demo Kasir
            </Link>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4 mx-auto max-w-3xl text-left">
            {[
              ["12.4K+", "Toko aktif"],
              ["3.2M", "Transaksi/bulan"],
              ["99.9%", "Uptime"],
              ["4.9 ★", "Rating user"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-lg border border-border bg-card/40 p-4">
                <div className="font-display text-2xl font-bold text-primary">{v}</div>
                <div className="text-xs text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="fitur" className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-4xl font-bold">Semua yang kamu butuh untuk jualan</h2>
            <p className="mt-3 text-muted-foreground">
              Dari front kasir sampai backoffice. Tanpa langganan tambahan, tanpa drama.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-border bg-card p-6 transition hover:border-primary/50 hover:bg-card/80"
              >
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-accent text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="harga" className="border-t border-border/60 py-20 bg-card/20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-display text-4xl font-bold">Harga sederhana, tanpa kejutan</h2>
            <p className="mt-3 text-muted-foreground">
              Mulai gratis. Upgrade kapan saja saat bisnismu tumbuh.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.name}
                className={`relative rounded-2xl border p-7 ${
                  p.featured
                    ? "border-primary bg-card shadow-[0_0_0_4px_color-mix(in_oklch,var(--color-primary)_15%,transparent)]"
                    : "border-border bg-card/60"
                }`}
              >
                {p.featured && (
                  <div className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                    PALING POPULER
                  </div>
                )}
                <h3 className="font-display text-xl font-bold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold">{p.price}</span>
                  {p.per && <span className="text-sm text-muted-foreground">{p.per}</span>}
                </div>
                <ul className="mt-6 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className={`mt-7 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold ${
                    p.featured
                      ? "bg-primary text-primary-foreground hover:opacity-90"
                      : "border border-border hover:bg-accent"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimoni" className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center font-display text-4xl font-bold">
            Dipercaya ribuan pelaku usaha
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-xl border border-border bg-card p-6">
                <p className="text-sm leading-relaxed">"{t.quote}"</p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-accent font-semibold text-accent-foreground">
                    {t.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <Smartphone className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 font-display text-4xl font-bold">
            Siap jualan lebih cepat hari ini?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Setup dalam 5 menit. Tanpa kartu kredit. Tanpa kontrak.
          </p>
          <Link
            to="/register"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Mulai Gratis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 text-xs text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5" /> © 2026 Warungin · Made in Indonesia
          </div>
          <div className="flex gap-5">
            <a href="#" className="hover:text-foreground">
              Privacy
            </a>
            <a href="#" className="hover:text-foreground">
              Terms
            </a>
            <a href="#" className="hover:text-foreground">
              Kontak
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
