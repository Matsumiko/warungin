import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
  Search,
  ScanLine,
  Trash2,
  Plus,
  Minus,
  Pause,
  Clock,
  X,
  CreditCard,
  Banknote,
  QrCode,
  Wallet,
  Smartphone,
  ArrowLeft,
  Receipt,
  CheckCircle as CheckIcon,
  XCircle as XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { getCatalog } from "@/lib/catalog";
import type { Product } from "@/lib/catalog.types";
import { formatIDR } from "@/lib/format";
import { getCurrentUser } from "@/lib/auth";
import { canAccessStandalonePath, roleHomePath } from "@/lib/auth-utils";
import {
  createTransaction,
  getActiveShift,
  getTenantSettings,
  getCustomers,
} from "@/lib/backoffice";

export const Route = createFileRoute("/cashier/")({
  head: () => ({ meta: [{ title: "Kasir · Warungin" }] }),
  beforeLoad: async () => {
    const session = await getCurrentUser();
    if (!session) throw redirect({ to: "/login" });
    if (!canAccessStandalonePath(session.role, "/cashier")) {
      throw redirect({ to: roleHomePath(session.role) });
    }
  },
  loader: async () => {
    const [session, tenantSettings, activeShift, customers] = await Promise.all([
      getCurrentUser(),
      getTenantSettings(),
      getActiveShift(),
      getCustomers(),
    ]);
    const outletId = activeShift?.outletId || undefined;
    const catalog = await getCatalog({ data: outletId });
    return { ...catalog, session, tenantSettings, activeShift, customers };
  },
  component: CashierPage,
});

interface CartItem {
  product: Product;
  qty: number;
  discount: number;
}

interface HeldOrder {
  id: string;
  items: CartItem[];
  note: string;
  total: number;
  heldAt: number;
}

const HELD_KEY = (tenantId: string) => `warungin:held:${tenantId}`;
const MAX_HELD = 10;

function playBeep(frequency: number, duration: number) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = frequency;
    osc.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, duration);
  } catch {
    // Web Audio not available — silent fallback
  }
}

function loadHeldOrders(tenantId: string): HeldOrder[] {
  try {
    const raw = localStorage.getItem(HELD_KEY(tenantId));
    return raw ? (JSON.parse(raw) as HeldOrder[]) : [];
  } catch {
    return [];
  }
}

function saveHeldOrders(tenantId: string, orders: HeldOrder[]) {
  try {
    localStorage.setItem(HELD_KEY(tenantId), JSON.stringify(orders));
  } catch {
    toast.error("Gagal menyimpan hold order");
  }
}

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return "Baru saja";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hr lalu`;
}

function isOn(value: string | undefined) {
  return value === "1" || value === "true";
}

function toRate(value: string | undefined) {
  const rate = Number(value ?? 0);
  if (!Number.isFinite(rate)) return 0;
  return Math.max(0, Math.min(100, rate));
}

function calculateTotals(subtotal: number, settings: Record<string, string>) {
  const taxRate = toRate(settings.taxRate);
  const serviceRate = toRate(settings.serviceCharge);
  const inclusiveTax = settings.taxMode === "inclusive";
  const tax =
    isOn(settings.taxEnabled) && taxRate > 0
      ? inclusiveTax
        ? Math.round((subtotal * taxRate) / (100 + taxRate))
        : Math.round((subtotal * taxRate) / 100)
      : 0;
  const serviceCharge = serviceRate > 0 ? Math.round((subtotal * serviceRate) / 100) : 0;
  return {
    tax,
    serviceCharge,
    total: subtotal + serviceCharge + (inclusiveTax ? 0 : tax),
    taxLabel: inclusiveTax ? `PPN ${taxRate}% (incl.)` : `PPN ${taxRate}%`,
    serviceLabel: `Service ${serviceRate}%`,
  };
}

function CashierPage() {
  const router = useRouter();
  const { categories, products, session, tenantSettings, activeShift, customers } =
    Route.useLoaderData();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const tenantId = session?.tenantId ?? "default";
  const [cart, setCart] = useState<CartItem[]>([]);
  const [note, setNote] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(() => loadHeldOrders(tenantId));
  const [scanFeedback, setScanFeedback] = useState<{ name: string; found: boolean } | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [pointsRedeemed, setPointsRedeemed] = useState(0);
  const saveTransaction = useServerFn(createTransaction);

  // Barcode scanner integration
  const handleBarcodeScan = useCallback(
    (barcode: string) => {
      const product = products.find((p) => p.barcode === barcode && p.active);
      if (product) {
        addToCart(product);
        setScanFeedback({ name: product.name, found: true });
        playBeep(1000, 100);
      } else {
        setScanFeedback({ name: barcode, found: false });
        playBeep(400, 200);
      }
      setTimeout(() => setScanFeedback(null), 2000);
    },
    [products],
  );

  const { inputRef: barcodeInputRef } = useBarcodeScanner({
    onScan: handleBarcodeScan,
  });

  useRealtimeEvents({
    onStockChanged: () => router.invalidate(),
  });

  // Keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastHeldRef = useRef<string | null>(null);
  useKeyboardShortcuts({
    onSearchFocus: () => searchInputRef.current?.focus(),
    onScannerFocus: () => barcodeInputRef.current?.focus(),
    onHoldOrder: () => {
      if (cart.length) {
        holdOrder();
      }
    },
    onVoidAll: () => {
      if (cart.length) {
        voidAll();
      }
    },
    onOpenCheckout: () => {
      if (cart.length) {
        setCheckoutOpen(true);
      }
    },
    onRecallHeld: () => {
      if (heldOrders.length > 0) {
        const last = heldOrders[0];
        lastHeldRef.current = last.id;
        recallHeldOrder(last.id);
      }
    },
    onCloseCheckout: () => setCheckoutOpen(false),
  });

  const filtered = useMemo(() => {
    return products.filter(
      (p) =>
        p.active &&
        (!catFilter || p.categoryId === catFilter) &&
        (!search ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.sku.toLowerCase().includes(search.toLowerCase()) ||
          p.barcode.includes(search)),
    );
  }, [products, search, catFilter]);

  function addToCart(p: Product) {
    setCart((c) => {
      const existing = c.find((i) => i.product.id === p.id);
      if (existing) return c.map((i) => (i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { product: p, qty: 1, discount: 0 }];
    });
  }
  function updateQty(id: string, delta: number) {
    setCart((c) =>
      c.map((i) => (i.product.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)),
    );
  }
  function removeItem(id: string) {
    setCart((c) => c.filter((i) => i.product.id !== id));
  }

  const subtotal = cart.reduce((s, i) => s + i.product.price * i.qty - i.discount, 0);
  const totals = calculateTotals(subtotal, tenantSettings.settings);
  const { tax, serviceCharge, total, taxLabel, serviceLabel } = totals;

  function holdOrder() {
    if (!cart.length) return;
    if (heldOrders.length >= MAX_HELD) {
      toast.warning(`Maksimal ${MAX_HELD} order ditahan. Hapus yang lama dulu.`);
      return;
    }
    const held: HeldOrder = {
      id: crypto.randomUUID(),
      items: structuredClone(cart),
      note,
      total,
      heldAt: Date.now(),
    };
    const next = [...heldOrders, held];
    setHeldOrders(next);
    saveHeldOrders(tenantId, next);
    setCart([]);
    setNote("");
    toast.success(`Order ditahan (${cart.length} item)`);
  }

  function recallHeldOrder(id: string) {
    const order = heldOrders.find((o) => o.id === id);
    if (!order) return;
    setCart(order.items);
    setNote(order.note);
    const next = heldOrders.filter((o) => o.id !== id);
    setHeldOrders(next);
    saveHeldOrders(tenantId, next);
    toast.info("Order dikembalikan ke keranjang");
  }

  function dismissHeldOrder(id: string) {
    const next = heldOrders.filter((o) => o.id !== id);
    setHeldOrders(next);
    saveHeldOrders(tenantId, next);
  }

  function voidAll() {
    if (!cart.length) return;
    setCart([]);
    toast.info("Keranjang dikosongkan");
  }

  async function completeCheckout(method: string, cashReceived: number) {
    const result = await saveTransaction({
      data: {
        paymentMethod: method,
        cashReceived,
        subtotal,
        tax,
        serviceCharge,
        total,
        outletId: activeShift?.outletId || undefined,
        customerId: selectedCustomerId || undefined,
        pointsRedeemed,
        items: cart.map((item) => ({
          productId: item.product.id,
          name: item.product.name,
          qty: item.qty,
          price: item.product.price,
        })),
      },
    });

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(`Pembayaran ${method} berhasil — ${formatIDR(total)}`);
    setCart([]);
    setNote("");
    setCheckoutOpen(false);
    router.invalidate();

    // Auto-print receipt if enabled
    if (tenantSettings.settings.receiptAutoPrint === "1") {
      const receiptUrl = `/print/receipt/${result.id}`;
      const printWindow = window.open(receiptUrl, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Topbar */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="rounded-md p-2 hover:bg-accent">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="font-display font-bold">Kasir</div>
            <div className="text-xs text-muted-foreground">
              {session?.tenantName ?? "Warungin"} · {session?.name ?? "Kasir"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            to="/cashier/shift/close"
            className="rounded-md border border-border px-3 py-1.5 hover:bg-accent"
          >
            Tutup Shift
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — products */}
        <div className="flex flex-1 flex-col border-r border-border">
          <div className="border-b border-border p-4 space-y-3">
            {/* Hidden barcode scanner input */}
            <input
              ref={barcodeInputRef}
              type="text"
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari produk, SKU, atau barcode… (F1)"
                  className="w-full rounded-lg border border-border bg-input/40 pl-10 pr-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
              <button
                onClick={() => barcodeInputRef.current?.focus()}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent"
              >
                <ScanLine className="h-4 w-4" /> Scan
                <kbd className="rounded bg-muted px-1 py-0.5 text-[9px] font-mono text-muted-foreground">
                  F2
                </kbd>
              </button>
            </div>
            {/* Scan feedback overlay */}
            {scanFeedback && (
              <div
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                  scanFeedback.found
                    ? "bg-green-500/15 text-green-400 border border-green-500/30"
                    : "bg-red-500/15 text-red-400 border border-red-500/30"
                }`}
              >
                {scanFeedback.found ? (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    {scanFeedback.name} — ditambahkan ke keranjang
                  </>
                ) : (
                  <>
                    <XIcon className="h-4 w-4" />
                    Barcode "{scanFeedback.name}" tidak ditemukan
                  </>
                )}
              </div>
            )}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <CatPill active={!catFilter} onClick={() => setCatFilter(null)}>
                Semua
              </CatPill>
              {categories.map((c) => (
                <CatPill key={c.id} active={catFilter === c.id} onClick={() => setCatFilter(c.id)}>
                  <span>{c.icon}</span> {c.name}
                </CatPill>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="group relative flex flex-col rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary hover:shadow-lg active:scale-[0.98]"
                >
                  <div className="aspect-square w-full rounded-lg bg-accent grid place-items-center text-3xl mb-2">
                    {categories.find((c) => c.id === p.categoryId)?.icon}
                  </div>
                  <div className="text-sm font-medium leading-tight line-clamp-2">{p.name}</div>
                  <div className="mt-auto pt-1.5 flex items-center justify-between">
                    <div className="font-display text-sm font-bold text-primary">
                      {formatIDR(p.price)}
                    </div>
                    <div
                      className={`text-[10px] font-medium ${p.stock <= p.minStock ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      stok {p.stock}
                    </div>
                  </div>
                </button>
              ))}
              {!filtered.length && (
                <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                  Tidak ada produk yang cocok
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — cart */}
        <aside className="flex w-[400px] shrink-0 flex-col bg-sidebar">
          <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
            <div className="font-display font-bold">Keranjang</div>
            <div className="text-xs text-muted-foreground">{cart.length} item</div>
          </div>
          {/* Customer selector */}
          <div className="border-b border-sidebar-border px-4 py-2">
            <select
              value={selectedCustomerId}
              onChange={(e) => {
                setSelectedCustomerId(e.target.value);
                setPointsRedeemed(0);
              }}
              className="w-full rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-2 text-xs outline-none"
            >
              <option value="">Walk-in Customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.level} · {c.points} pts)
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {!cart.length && (
              <div className="grid place-items-center py-16 text-center">
                <Receipt className="h-10 w-10 text-muted-foreground/40" />
                <div className="mt-3 text-sm text-muted-foreground">Keranjang kosong</div>
                <div className="text-xs text-muted-foreground/60">Klik produk untuk menambah</div>
              </div>
            )}
            {cart.map((i) => (
              <div
                key={i.product.id}
                className="rounded-lg border border-sidebar-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{i.product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatIDR(i.product.price)} / {i.product.unit}
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(i.product.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex items-center rounded-md border border-border">
                    <button
                      onClick={() => updateQty(i.product.id, -1)}
                      className="grid h-7 w-7 place-items-center hover:bg-accent"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{i.qty}</span>
                    <button
                      onClick={() => updateQty(i.product.id, 1)}
                      className="grid h-7 w-7 place-items-center hover:bg-accent"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="font-display text-sm font-bold">
                    {formatIDR(i.product.price * i.qty)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Held Orders */}
          {heldOrders.length > 0 && (
            <div className="border-t border-sidebar-border px-3 py-3 space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="text-xs font-medium text-muted-foreground">
                  Order Ditahan ({heldOrders.length})
                </div>
              </div>
              {heldOrders.map((h) => (
                <div
                  key={h.id}
                  className="rounded-lg border border-sidebar-border bg-accent/30 p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium">
                        {h.items.length} item · {formatIDR(h.total)}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(h.heldAt)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => recallHeldOrder(h.id)}
                        className="rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:bg-accent"
                      >
                        Ambil
                      </button>
                      <button
                        onClick={() => dismissHeldOrder(h.id)}
                        className="rounded-md px-1.5 py-1 text-[10px] text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <div className="border-t border-sidebar-border p-4 space-y-3">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan transaksi (opsional)"
              className="w-full rounded-md border border-border bg-input/40 px-3 py-2 text-xs outline-none focus:border-primary"
            />
            <div className="space-y-1 text-sm">
              <Row label="Subtotal" value={formatIDR(subtotal)} />
              {tax > 0 && <Row label={taxLabel} value={formatIDR(tax)} />}
              {serviceCharge > 0 && <Row label={serviceLabel} value={formatIDR(serviceCharge)} />}
              <div className="my-2 border-t border-sidebar-border" />
              <div className="flex justify-between font-display text-lg font-bold">
                <span>TOTAL</span>
                <span className="text-primary">{formatIDR(total)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={holdOrder}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border py-2 text-xs font-medium hover:bg-accent"
              >
                <Pause className="h-3.5 w-3.5" /> Hold
                <kbd className="ml-1 rounded bg-muted px-1 py-0.5 text-[9px] font-mono text-muted-foreground">
                  F3
                </kbd>
              </button>
              <button
                onClick={voidAll}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border py-2 text-xs font-medium hover:bg-destructive/20 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" /> Void All
                <kbd className="ml-1 rounded bg-muted px-1 py-0.5 text-[9px] font-mono text-muted-foreground">
                  F4
                </kbd>
              </button>
            </div>
            <button
              disabled={!cart.length}
              onClick={() => setCheckoutOpen(true)}
              className="w-full rounded-lg bg-primary py-3 font-display font-bold text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Bayar · {formatIDR(total)}
              <kbd className="ml-2 rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[9px] font-mono">
                F5
              </kbd>
            </button>
          </div>
        </aside>
      </div>

      {checkoutOpen && (
        <CheckoutModal
          total={total}
          onClose={() => setCheckoutOpen(false)}
          onPay={completeCheckout}
        />
      )}
    </div>
  );
}

function CatPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function CheckoutModal({
  total,
  onClose,
  onPay,
}: {
  total: number;
  onClose: () => void;
  onPay: (method: string, cashReceived: number) => Promise<void>;
}) {
  const [method, setMethod] = useState<string>("Cash");
  const [cash, setCash] = useState<number>(total);
  const [submitting, setSubmitting] = useState(false);
  const change = cash - total;

  const methods = [
    { id: "Cash", icon: Banknote },
    { id: "QRIS", icon: QrCode },
    { id: "Debit", icon: CreditCard },
    { id: "E-Wallet", icon: Smartphone },
    { id: "Transfer", icon: Wallet },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="mx-auto my-4 w-full max-w-lg rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Pembayaran</h2>
          <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 rounded-xl bg-primary/10 p-5 text-center">
          <div className="text-xs text-muted-foreground">Total Tagihan</div>
          <div className="mt-1 font-display text-4xl font-bold text-primary">
            {formatIDR(total)}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-xs font-medium text-muted-foreground mb-2">Metode Pembayaran</div>
          <div className="grid grid-cols-5 gap-2">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMethod(m.id);
                  setCash(total);
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium transition ${
                  method === m.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
                }`}
              >
                <m.icon className="h-5 w-5" />
                {m.id}
              </button>
            ))}
          </div>
        </div>

        {method === "Cash" && (
          <div className="mt-5 space-y-3">
            <label className="text-sm font-medium">Uang Diterima</label>
            <input
              type="number"
              value={cash}
              onChange={(e) => setCash(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-input/40 px-3 py-3 text-right text-xl font-bold outline-none focus:border-primary"
            />
            <div className="grid grid-cols-4 gap-2">
              {[50000, 100000, 150000, 200000].map((v) => (
                <button
                  key={v}
                  onClick={() => setCash(v)}
                  className="rounded-md border border-border py-2 text-xs hover:bg-accent"
                >
                  {formatIDR(v)}
                </button>
              ))}
            </div>
            <div className="flex justify-between rounded-lg bg-accent/40 p-3 text-sm">
              <span className="text-muted-foreground">Kembalian</span>
              <span
                className={`font-display font-bold ${change >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatIDR(Math.max(0, change))}
              </span>
            </div>
          </div>
        )}

        {method === "QRIS" && (
          <div className="mt-5 grid place-items-center rounded-xl border border-border bg-background p-6">
            <div className="grid h-40 w-40 place-items-center rounded-lg bg-white">
              <QrCode className="h-32 w-32 text-black" />
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Scan QRIS dengan aplikasi pembayaran
            </div>
          </div>
        )}

        <button
          disabled={submitting || (method === "Cash" && change < 0)}
          onClick={async () => {
            setSubmitting(true);
            try {
              await onPay(method, method === "Cash" ? cash : total);
            } finally {
              setSubmitting(false);
            }
          }}
          className="mt-5 w-full rounded-lg bg-primary py-3 font-display font-bold text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {submitting ? "Menyimpan..." : "Selesai"}
        </button>
      </div>
    </div>
  );
}
