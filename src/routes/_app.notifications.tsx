import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Info, CheckCircle, XCircle, Bell, BellOff, Filter } from "lucide-react";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/backoffice";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

export const Route = createFileRoute("/_app/notifications")({
  loader: () => getNotifications({ data: {} }),
  component: NotificationsPage,
});

const TYPE_LABELS: Record<string, string> = {
  all: "Semua",
  low_stock: "Stok Rendah",
  shift_opened: "Shift Dibuka",
  shift_closed: "Shift Ditutup",
  info: "Info",
};

const TYPE_OPTIONS = ["all", "low_stock", "shift_opened", "shift_closed", "info"];

function SeverityIcon({ severity }: { severity: string }) {
  const cls = "h-5 w-5";
  if (severity === "error") return <XCircle className={`${cls} text-red-400`} />;
  if (severity === "warning") return <AlertTriangle className={`${cls} text-yellow-400`} />;
  if (severity === "success") return <CheckCircle className={`${cls} text-green-400`} />;
  return <Info className={`${cls} text-blue-400`} />;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + "Z").getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "Baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

function NotificationsPage() {
  const notifs = Route.useLoaderData();
  const router = useRouter();
  const [filterType, setFilterType] = useState("all");
  const markRead = useServerFn(markNotificationRead);
  const markAllRead = useServerFn(markAllNotificationsRead);

  useRealtimeEvents({
    onNotificationCreated: () => router.invalidate(),
  });

  const filtered = notifs.filter((n) => filterType === "all" || n.type === filterType);

  const unreadCount = notifs.filter((n) => !n.is_read).length;

  async function handleMarkRead(id: string) {
    await markRead({ data: { id } });
    router.invalidate();
  }

  async function handleMarkAllRead() {
    await markAllRead();
    router.invalidate();
  }

  return (
    <div className="p-6 max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Notifikasi</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} belum dibaca` : "Semua sudah dibaca"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <BellOff className="h-4 w-4" />
            Tandai semua dibaca
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterType === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {TYPE_LABELS[t] ?? t}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {filtered.map((n) => (
          <button
            key={n.id}
            onClick={() => !n.is_read && handleMarkRead(n.id)}
            className={`flex w-full items-start gap-4 p-4 text-left transition-colors ${
              !n.is_read ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/30"
            }`}
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted/50">
              <SeverityIcon severity={n.severity} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{n.title}</span>
                {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </div>
              {n.description && (
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {n.description}
                </div>
              )}
              <div className="text-xs text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</div>
            </div>
          </button>
        ))}
        {!filtered.length && (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/40" />
            <div className="text-sm text-muted-foreground">
              {filterType === "all"
                ? "Belum ada notifikasi."
                : "Tidak ada notifikasi untuk filter ini."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
