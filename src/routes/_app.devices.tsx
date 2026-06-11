import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Monitor,
  Printer,
  Smartphone,
  Tablet,
  Wifi,
  WifiOff,
  LogOut,
  Plus,
  Link2,
  CheckCircle2,
  QrCode,
  Copy,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { createDevicePairing, getDevices, logoutDevice } from "@/lib/backoffice";

export const Route = createFileRoute("/_app/devices")({
  head: () => ({ meta: [{ title: "Multi Device · Warungin" }] }),
  loader: () => getDevices(),
  component: DevicesPage,
});

type DeviceKind = "cashier" | "display" | "printer" | "mobile";
type Status = "online" | "offline" | "pending";

const kindMeta: Record<DeviceKind, { icon: LucideIcon; label: string; color: string }> = {
  cashier: { icon: Monitor, label: "Kasir", color: "text-primary bg-primary/15" },
  display: { icon: Tablet, label: "Customer Display", color: "text-cyan-300 bg-cyan-500/15" },
  printer: { icon: Printer, label: "Printer", color: "text-warning bg-warning/15" },
  mobile: { icon: Smartphone, label: "Mobile", color: "text-success bg-success/15" },
};

function DevicesPage() {
  const router = useRouter();
  const createPairing = useServerFn(createDevicePairing);
  const saveLogoutDevice = useServerFn(logoutDevice);
  const loadedDevices = Route.useLoaderData().map((device) => ({
    id: device.id,
    name: device.name,
    kind: device.kind as DeviceKind,
    outlet: "-",
    user: device.user_name || undefined,
    status: device.status as Status,
    lastSeen: device.last_seen ?? "-",
    paired: undefined as string | undefined,
  }));
  const [pairOpen, setPairOpen] = useState(false);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onlineCount = loadedDevices.filter((d) => d.status === "online").length;

  async function handleLogoutDevice(id: string) {
    await saveLogoutDevice({ data: { id } });
    toast.success("Device telah di-logout");
    await router.invalidate();
  }

  async function handlePairSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const result = await createPairing({
        data: {
          name: String(form.get("name") ?? ""),
          kind: String(form.get("kind") ?? "display") as DeviceKind,
        },
      });
      setPairCode(result.code);
      toast.success("Request pairing device tersimpan");
      await router.invalidate();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Multi Device & Pairing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pasangkan customer display, printer, dan kasir aktif. Kontrol semua device toko dari
            sini.
          </p>
        </div>
        <button
          onClick={() => setPairOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Pasangkan Device
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total Device" value={loadedDevices.length} icon={Monitor} />
        <Stat label="Online" value={onlineCount} icon={Wifi} tone="success" />
        <Stat
          label="Offline"
          value={loadedDevices.length - onlineCount}
          icon={WifiOff}
          tone="muted"
        />
        <Stat
          label="Sesi Aktif"
          value={loadedDevices.filter((d) => d.user).length}
          icon={CheckCircle2}
          tone="primary"
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-12 gap-2 border-b border-border bg-muted/30 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Device</div>
          <div className="col-span-2">Tipe</div>
          <div className="col-span-2">Outlet</div>
          <div className="col-span-2">Kasir Aktif</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1 text-right">Aksi</div>
        </div>
        {loadedDevices.map((d) => {
          const Meta = kindMeta[d.kind];
          return (
            <div
              key={d.id}
              className="grid grid-cols-12 items-center gap-2 border-b border-border px-5 py-4 last:border-0 hover:bg-muted/20"
            >
              <div className="col-span-4 flex items-center gap-3">
                <div className={`grid h-10 w-10 place-items-center rounded-lg ${Meta.color}`}>
                  <Meta.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{d.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <span>{d.id}</span>
                    {d.paired && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-[10px]">
                        <Link2 className="h-3 w-3" /> Paired {d.paired}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-span-2 text-sm">{Meta.label}</div>
              <div className="col-span-2 text-sm text-muted-foreground">{d.outlet}</div>
              <div className="col-span-2 text-sm">
                {d.user ?? <span className="text-muted-foreground italic">—</span>}
              </div>
              <div className="col-span-1">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs ${d.status === "online" ? "text-success" : "text-muted-foreground"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${d.status === "online" ? "bg-success animate-pulse" : "bg-muted-foreground/50"}`}
                  />
                  {d.status === "online" ? "Online" : "Offline"}
                </span>
                <div className="text-[10px] text-muted-foreground">{d.lastSeen}</div>
              </div>
              <div className="col-span-1 flex justify-end">
                {d.status === "online" && d.user ? (
                  <button
                    onClick={() => handleLogoutDevice(d.id)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Logout
                  </button>
                ) : (
                  <button
                    onClick={() => setPairOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs hover:bg-accent"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Pair
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pairOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setPairOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold">Pasangkan Device Baru</h3>
                <p className="text-xs text-muted-foreground">
                  Buka /customer-display atau aplikasi printer, lalu masukkan kode ini.
                </p>
              </div>
            </div>
            <form onSubmit={handlePairSubmit} className="mb-5 grid gap-3">
              <input
                name="name"
                required
                placeholder="Nama device"
                className="rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <select
                name="kind"
                defaultValue="display"
                className="rounded-lg border border-border bg-input/40 px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="display">Customer Display</option>
                <option value="printer">Printer</option>
                <option value="cashier">Kasir</option>
                <option value="mobile">Mobile</option>
              </select>
              <button
                disabled={submitting}
                className="rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Menyimpan..." : "Buat Kode Pairing"}
              </button>
            </form>
            <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Kode Pairing
              </div>
              <div className="font-display text-4xl font-bold text-primary tracking-[0.3em]">
                {pairCode ?? "------"}
              </div>
              <button
                type="button"
                disabled={!pairCode}
                onClick={() => {
                  if (!pairCode) return;
                  navigator.clipboard?.writeText(pairCode.replace(/\s/g, ""));
                  toast.success("Kode disalin");
                }}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
              >
                <Copy className="h-3 w-3" /> Salin kode
              </button>
            </div>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> atau scan QR{" "}
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid place-items-center">
              <div className="grid h-40 w-40 place-items-center rounded-xl bg-white">
                <QrCode className="h-32 w-32 text-black" />
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Kode kadaluarsa dalam 5 menit.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPairOpen(false)}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium hover:bg-accent"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  toast.success("Request pairing tersimpan di database");
                  setPairOpen(false);
                }}
                className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Tunggu Koneksi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "success" | "muted" | "primary";
}) {
  const color =
    tone === "success"
      ? "text-success bg-success/15"
      : tone === "muted"
        ? "text-muted-foreground bg-muted"
        : tone === "primary"
          ? "text-primary bg-primary/15"
          : "text-foreground bg-accent";
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
      <div className={`grid h-10 w-10 place-items-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-display text-xl font-bold">{value}</div>
      </div>
    </div>
  );
}
