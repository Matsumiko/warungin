import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { getAuditLogs } from "@/lib/backoffice";

export const Route = createFileRoute("/_app/audit-logs")({
  head: () => ({ meta: [{ title: "Audit Log · Warungin" }] }),
  loader: () => getAuditLogs(),
  component: AuditLogsPage,
});

function AuditLogsPage() {
  const logs = Route.useLoaderData();

  return (
    <div className="p-6 space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold">Audit Log</h2>
        <p className="mt-1 text-sm text-muted-foreground">Riwayat aktivitas toko dari database.</p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-accent/30 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Aksi</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-border hover:bg-accent/20">
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(log.occurred_at).toLocaleString("id-ID")}
                </td>
                <td className="px-4 py-3">{log.user_name || "-"}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                    <ShieldCheck className="h-3 w-3" />
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3">{log.target || "-"}</td>
                <td className="px-4 py-3 text-muted-foreground">{log.detail || "-"}</td>
              </tr>
            ))}
            {!logs.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Belum ada audit log di database.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
