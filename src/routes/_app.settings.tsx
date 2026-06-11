import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Store,
  Receipt,
  CreditCard,
  Percent,
  Printer,
  Bell,
  Shield,
  Palette,
  Globe,
  Save,
  Upload,
  Monitor,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { getCurrentUser, getUserSessions, revokeSession, revokeAllOtherSessions } from "@/lib/auth";
import { getDevices, getTenantSettings, updateTenantSettings } from "@/lib/backoffice";
import { setTheme } from "@/hooks/useTheme";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Pengaturan · Warungin" }] }),
  loader: async () => {
    const [session, devices, tenantSettings, sessions] = await Promise.all([
      getCurrentUser(),
      getDevices(),
      getTenantSettings(),
      getUserSessions(),
    ]);
    return { session, devices, tenantSettings, sessions };
  },
  component: SettingsPage,
});

const tabs = [
  { id: "toko", label: "Toko", icon: Store },
  { id: "pajak", label: "Pajak & Biaya", icon: Percent },
  { id: "struk", label: "Struk", icon: Receipt },
  { id: "pembayaran", label: "Pembayaran", icon: CreditCard },
  { id: "printer", label: "Printer", icon: Printer },
  { id: "notifikasi", label: "Notifikasi", icon: Bell },
  { id: "tampilan", label: "Tampilan", icon: Palette },
  { id: "keamanan", label: "Keamanan", icon: Shield },
  { id: "sesi", label: "Sesi Aktif", icon: Monitor },
] as const;

function SettingsPage() {
  const router = useRouter();
  const { session, devices = [], tenantSettings, sessions = [] } = Route.useLoaderData();
  const saveSettings = useServerFn(updateTenantSettings);
  const revokeOne = useServerFn(revokeSession);
  const revokeAll = useServerFn(revokeAllOtherSessions);
  const printers = devices.filter((device) => device.kind.toLowerCase().includes("printer"));
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("toko");
  const [submitting, setSubmitting] = useState(false);
  const settings = tenantSettings.settings;

  async function handleRevokeOne(sessionId: string) {
    await revokeOne({ data: { sessionId } });
    toast.success("Sesi berhasil dicabut.");
    router.invalidate();
  }

  async function handleRevokeAll() {
    const result = await revokeAll();
    if (result.ok && result.revoked > 0) {
      toast.success(`${result.revoked} sesi lain berhasil dicabut.`);
    } else if (result.ok) {
      toast.info("Tidak ada sesi lain yang aktif.");
    } else {
      toast.error(result.message ?? "Gagal mencabut sesi.");
    }
    router.invalidate();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const storeName = String(form.get("storeName") ?? "").trim();
    const nextSettings: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (key === "storeName") continue;
      nextSettings[key] = String(value);
    }
    setSubmitting(true);
    try {
      const result = await saveSettings({
        data: {
          storeName: storeName || undefined,
          settings: nextSettings,
        },
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Pengaturan disimpan");
      await router.invalidate();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-bold">Pengaturan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Atur informasi toko, pajak, struk, pembayaran, dan lainnya.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="space-y-1">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        {tab !== "sesi" ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            {tab === "toko" && (
              <Card title="Informasi Toko" icon={Store}>
                <div className="flex items-start gap-5">
                  <div className="space-y-2">
                    <div className="grid h-24 w-24 place-items-center rounded-xl border-2 border-dashed border-border bg-muted/30">
                      <Store className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Upload className="h-3 w-3" /> Upload Logo
                    </button>
                  </div>
                  <div className="flex-1 grid gap-4 sm:grid-cols-2">
                    <Field label="Nama Toko">
                      <input
                        name="storeName"
                        defaultValue={tenantSettings.storeName}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Jenis Usaha">
                      <select
                        name="businessType"
                        defaultValue={settings.businessType}
                        className={inputCls}
                      >
                        <option value="Retail Umum">Retail Umum</option>
                        <option value="Minimarket">Minimarket</option>
                        <option value="F&B">F&B</option>
                        <option value="Salon">Salon</option>
                      </select>
                    </Field>
                    <Field label="Alamat" full>
                      <textarea
                        name="address"
                        rows={2}
                        defaultValue={settings.address}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="No. Telepon">
                      <input name="phone" defaultValue={settings.phone} className={inputCls} />
                    </Field>
                    <Field label="Email">
                      <input
                        name="email"
                        defaultValue={settings.email || session?.email || ""}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="NPWP">
                      <input
                        name="npwp"
                        defaultValue={settings.npwp}
                        placeholder="00.000.000.0-000.000"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Mata Uang">
                      <select name="currency" defaultValue={settings.currency} className={inputCls}>
                        <option value="IDR">IDR — Rupiah</option>
                      </select>
                    </Field>
                  </div>
                </div>
              </Card>
            )}

            {tab === "pajak" && (
              <Card title="Pajak & Service Charge" icon={Percent}>
                <Toggle
                  name="taxEnabled"
                  label="Aktifkan PPN"
                  defaultChecked={isOn(settings.taxEnabled)}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="PPN (%)">
                    <input
                      name="taxRate"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={settings.taxRate}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Service Charge (%)">
                    <input
                      name="serviceCharge"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={settings.serviceCharge}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Mode Pajak">
                    <select name="taxMode" defaultValue={settings.taxMode} className={inputCls}>
                      <option value="exclusive">Exclusive (ditambahkan)</option>
                      <option value="inclusive">Inclusive (sudah termasuk)</option>
                    </select>
                  </Field>
                  <Field label="Pembulatan">
                    <select name="rounding" defaultValue={settings.rounding} className={inputCls}>
                      <option value="none">Tidak ada</option>
                      <option value="100">Ke 100 terdekat</option>
                      <option value="500">Ke 500 terdekat</option>
                    </select>
                  </Field>
                </div>
              </Card>
            )}

            {tab === "struk" && (
              <Card title="Format Struk" icon={Receipt}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Ukuran Kertas">
                    <select
                      name="receiptPaper"
                      defaultValue={settings.receiptPaper}
                      className={inputCls}
                    >
                      <option value="58mm">58mm</option>
                      <option value="80mm">80mm</option>
                      <option value="A4">A4</option>
                    </select>
                  </Field>
                  <Field label="Bahasa Struk">
                    <select
                      name="receiptLanguage"
                      defaultValue={settings.receiptLanguage}
                      className={inputCls}
                    >
                      <option value="id">Bahasa Indonesia</option>
                      <option value="en">English</option>
                    </select>
                  </Field>
                  <Field label="Header Struk" full>
                    <input
                      name="receiptHeader"
                      defaultValue={settings.receiptHeader || tenantSettings.storeName}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Footer Struk" full>
                    <textarea
                      name="receiptFooter"
                      rows={2}
                      defaultValue={settings.receiptFooter}
                      className={inputCls}
                    />
                  </Field>
                </div>
                <div className="space-y-2 pt-2 border-t border-border">
                  <Toggle
                    name="receiptShowLogo"
                    label="Tampilkan logo toko"
                    defaultChecked={isOn(settings.receiptShowLogo)}
                  />
                  <Toggle
                    name="receiptShowCashier"
                    label="Tampilkan nama kasir"
                    defaultChecked={isOn(settings.receiptShowCashier)}
                  />
                  <Toggle
                    name="receiptShowQr"
                    label="Tampilkan QR code transaksi"
                    defaultChecked={isOn(settings.receiptShowQr)}
                  />
                  <Toggle
                    name="receiptAutoPrint"
                    label="Cetak struk otomatis setelah checkout"
                    defaultChecked={isOn(settings.receiptAutoPrint)}
                  />
                </div>
              </Card>
            )}

            {tab === "pembayaran" && (
              <Card title="Metode Pembayaran" icon={CreditCard}>
                {[
                  { key: "paymentCash", name: "Cash", desc: "Tunai" },
                  { key: "paymentQris", name: "QRIS", desc: "Semua aplikasi e-wallet & bank" },
                  { key: "paymentCard", name: "Debit / Kartu", desc: "EDC" },
                  { key: "paymentTransfer", name: "Transfer Bank", desc: "Manual konfirmasi" },
                  { key: "paymentGopay", name: "GoPay", desc: "E-wallet" },
                  { key: "paymentOvo", name: "OVO", desc: "E-wallet" },
                  { key: "paymentDana", name: "DANA", desc: "E-wallet" },
                  { key: "paymentShopeepay", name: "ShopeePay", desc: "E-wallet" },
                ].map((m) => (
                  <div
                    key={m.name}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.desc}</div>
                    </div>
                    <Switch
                      name={m.key}
                      defaultChecked={isOn(settings[m.key as keyof typeof settings])}
                    />
                  </div>
                ))}
                <Toggle
                  name="splitPayment"
                  label="Izinkan split payment"
                  defaultChecked={isOn(settings.splitPayment)}
                />
              </Card>
            )}

            {tab === "printer" && (
              <Card title="Pengaturan Printer" icon={Printer}>
                <Field label="Printer Default">
                  <select
                    name="defaultPrinterId"
                    defaultValue={settings.defaultPrinterId}
                    className={inputCls}
                  >
                    <option value="">Belum ada printer terhubung</option>
                    {printers.map((printer) => (
                      <option key={printer.id} value={printer.id}>
                        {printer.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Mode Koneksi">
                  <select
                    name="printerConnection"
                    defaultValue={settings.printerConnection}
                    className={inputCls}
                  >
                    <option value="usb">USB</option>
                    <option value="bluetooth">Bluetooth</option>
                    <option value="network">Network (LAN/WiFi)</option>
                    <option value="browser">Browser Print</option>
                  </select>
                </Field>
                <Toggle
                  name="printerEscpos"
                  label="ESC/POS thermal mode"
                  defaultChecked={isOn(settings.printerEscpos)}
                />
                <Toggle
                  name="printerCashDrawer"
                  label="Buka cash drawer otomatis saat checkout cash"
                  defaultChecked={isOn(settings.printerCashDrawer)}
                />
                <Toggle
                  name="printerKitchen"
                  label="Cetak struk dapur (untuk F&B)"
                  defaultChecked={isOn(settings.printerKitchen)}
                />
              </Card>
            )}

            {tab === "notifikasi" && (
              <Card title="Notifikasi" icon={Bell}>
                <Toggle
                  name="notifyLowStock"
                  label="Stok menipis di bawah minimum"
                  defaultChecked={isOn(settings.notifyLowStock)}
                />
                <Toggle
                  name="notifyOpenShift"
                  label="Shift belum ditutup > 12 jam"
                  defaultChecked={isOn(settings.notifyOpenShift)}
                />
                <Toggle
                  name="notifyRefundApproval"
                  label="Refund menunggu approval"
                  defaultChecked={isOn(settings.notifyRefundApproval)}
                />
                <Toggle
                  name="notifyLatePo"
                  label="PO belum diterima > 3 hari"
                  defaultChecked={isOn(settings.notifyLatePo)}
                />
                <Toggle
                  name="notifySalesDrop"
                  label="Penjualan abnormal (turun > 30%)"
                  defaultChecked={isOn(settings.notifySalesDrop)}
                />
                <Toggle
                  name="notifyCashDiff"
                  label="Cash selisih saat tutup shift"
                  defaultChecked={isOn(settings.notifyCashDiff)}
                />
                <Toggle
                  name="notifyExpiredProduct"
                  label="Produk akan/sudah expired"
                  defaultChecked={isOn(settings.notifyExpiredProduct)}
                />
                <div className="pt-2 border-t border-border space-y-2">
                  <Field label="Email penerima">
                    <input
                      name="notificationEmail"
                      type="email"
                      defaultValue={settings.notificationEmail || session?.email || ""}
                      className={inputCls}
                    />
                  </Field>
                  <Toggle
                    name="pushNotifications"
                    label="Kirim push notifikasi ke mobile"
                    defaultChecked={isOn(settings.pushNotifications)}
                  />
                </div>
              </Card>
            )}

            {tab === "tampilan" && (
              <Card title="Tampilan" icon={Palette}>
                <Field label="Tema">
                  <div className="grid grid-cols-3 gap-2">
                    {(["dark-navy", "light", "auto"] as const).map((value) => (
                      <label
                        key={value}
                        className={`cursor-pointer rounded-lg border px-3 py-3 text-center text-sm ${settings.theme === value ? "border-primary bg-primary/10" : "border-border"}`}
                      >
                        <input
                          type="radio"
                          name="theme"
                          value={value}
                          className="sr-only"
                          defaultChecked={settings.theme === value}
                          onChange={() => setTheme(value)}
                        />
                        {value === "dark-navy" ? "Dark Navy" : value === "light" ? "Light" : "Auto"}
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="Bahasa Aplikasi">
                  <select
                    name="appLanguage"
                    defaultValue={settings.appLanguage}
                    className={inputCls}
                  >
                    <option value="id">Bahasa Indonesia</option>
                    <option value="en">English</option>
                  </select>
                </Field>
                <Field label="Format Tanggal">
                  <select name="dateFormat" defaultValue={settings.dateFormat} className={inputCls}>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </Field>
              </Card>
            )}

            {tab === "keamanan" && (
              <Card title="Keamanan" icon={Shield}>
                <Toggle
                  name="requirePinVoid"
                  label="Wajib PIN saat void transaksi"
                  defaultChecked={isOn(settings.requirePinVoid)}
                />
                <Toggle
                  name="requireRefundApproval"
                  label="Wajib approval owner untuk refund > Rp 100.000"
                  defaultChecked={isOn(settings.requireRefundApproval)}
                />
                <Toggle
                  name="autoLogoutIdle"
                  label="Auto-logout kasir setelah 30 menit idle"
                  defaultChecked={isOn(settings.autoLogoutIdle)}
                />
                <Toggle
                  name="ownerTwoFactor"
                  label="2FA untuk owner & manager"
                  defaultChecked={isOn(settings.ownerTwoFactor)}
                />
                <Field label="Sesi maksimum (menit)">
                  <input
                    name="maxSessionMinutes"
                    type="number"
                    min={5}
                    defaultValue={settings.maxSessionMinutes}
                    className={inputCls}
                  />
                </Field>
              </Card>
            )}

            <div className="flex justify-end gap-2 sticky bottom-0 bg-background/80 backdrop-blur py-3 -mx-1 px-1">
              <button
                type="button"
                className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-accent"
              >
                Batal
              </button>
              <button
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {submitting ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <Card title="Sesi Aktif" icon={Monitor}>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {sessions.length} sesi aktif di berbagai perangkat
                </p>
                {sessions.filter((s) => !s.isCurrent).length > 0 && (
                  <button
                    type="button"
                    onClick={handleRevokeAll}
                    className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
                  >
                    <LogOut className="h-4 w-4" />
                    Keluar dari Semua Perangkat
                  </button>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                      s.isCurrent ? "border-primary/30 bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{parseUserAgent(s.userAgent)}</span>
                        {s.isCurrent && (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Perangkat ini
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{s.ipAddress || "Unknown IP"}</span>
                        {s.lastSeenAt && (
                          <span>Terakhir aktif: {formatLastSeen(s.lastSeenAt)}</span>
                        )}
                      </div>
                    </div>
                    {!s.isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleRevokeOne(s.id)}
                        className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                      >
                        Cabut
                      </button>
                    )}
                  </div>
                ))}
                {!sessions.length && (
                  <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                    Tidak ada sesi aktif.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-input/40 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function isOn(value: string | undefined) {
  return value === "1" || value === "true";
}

function parseUserAgent(ua: string): string {
  if (!ua) return "Unknown Device";
  let browser = "Browser lain";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";

  let os = "OS lain";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  return `${browser} · ${os}`;
}

function formatLastSeen(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + "Z").getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "Baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-display font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}
function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm">{label}</span>
      <Switch name={name} defaultChecked={defaultChecked} />
    </label>
  );
}
function Switch({ name, defaultChecked }: { name: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <>
      <input type="hidden" name={name} value={on ? "1" : "0"} />
      <button
        type="button"
        onClick={() => setOn(!on)}
        className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}
        aria-pressed={on}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </button>
    </>
  );
}
