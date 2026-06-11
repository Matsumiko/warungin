import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
  Package,
  Boxes,
  Receipt,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  exportTenantData,
  getImportExportActivity,
  importTenantCsv,
  validateImportCsv,
} from "@/lib/backoffice";

export const Route = createFileRoute("/_app/import-export")({
  head: () => ({ meta: [{ title: "Import & Export · Warungin" }] }),
  loader: () => getImportExportActivity(),
  component: ImportExportPage,
});

const exportItems = [
  {
    kind: "products",
    icon: Package,
    title: "Produk",
    desc: "Semua produk + harga + stok awal",
    formats: ["CSV", "Excel"],
  },
  {
    kind: "transactions",
    icon: Receipt,
    title: "Transaksi",
    desc: "Penjualan periode tertentu",
    formats: ["CSV", "Excel", "PDF"],
  },
  {
    kind: "shifts",
    icon: ClipboardList,
    title: "Laporan Shift",
    desc: "Detail buka/tutup shift kasir",
    formats: ["CSV", "PDF"],
  },
  {
    kind: "stock",
    icon: Boxes,
    title: "Stok & Mutasi",
    desc: "Posisi stok terkini + riwayat mutasi",
    formats: ["CSV", "Excel"],
  },
] as const;

const importItems = [
  {
    kind: "products",
    icon: Package,
    title: "Import Produk Massal",
    desc: "Upload daftar produk lewat template CSV",
    template: "template-produk.csv",
    templateContent:
      "name,sku,barcode,category,price,cost,stock,min_stock,unit,active\nKopi Susu,SKU-001,899000000001,Minuman,18000,9000,25,5,cup,yes\n",
  },
  {
    kind: "stock",
    icon: Boxes,
    title: "Import Stok Awal",
    desc: "Input stok awal per outlet via CSV",
    template: "template-stok.csv",
    templateContent: "sku,stock,note\nSKU-001,50,Stok awal outlet utama\n",
  },
] as const;

type ExportKind = (typeof exportItems)[number]["kind"];
type ImportKind = (typeof importItems)[number]["kind"];
type ExportFormat = "CSV" | "Excel" | "PDF";

function downloadFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ImportExportPage() {
  const router = useRouter();
  const recent = Route.useLoaderData();
  const exportData = useServerFn(exportTenantData);
  const importCsv = useServerFn(importTenantCsv);
  const validateCsv = useServerFn(validateImportCsv);
  const [period, setPeriod] = useState("bulan-ini");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [importing, setImporting] = useState<ImportKind | null>(null);
  const [validating, setValidating] = useState<ImportKind | null>(null);
  const [preview, setPreview] = useState<{
    kind: ImportKind;
    filename: string;
    content: string;
    result: {
      rows: Array<{
        rowNumber: number;
        data: Record<string, string>;
        status: string;
        messages: string[];
      }>;
      summary: { total: number; ok: number; warn: number; error: number };
    };
  } | null>(null);

  async function handleExport(kind: ExportKind, format: ExportFormat) {
    const key = `${kind}-${format}`;
    setDownloading(key);
    try {
      const result = await exportData({ data: { kind, format, period } });
      if (!result.ok) return;
      downloadFile(result.filename, result.content, result.mime);
      toast.success(`${result.filename} berhasil diunduh`);
      router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export gagal");
    } finally {
      setDownloading(null);
    }
  }

  async function handleImport(kind: ImportKind, file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("File harus CSV.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran CSV maksimal 5 MB.");
      return;
    }
    setValidating(kind);
    try {
      const content = await file.text();
      const result = await validateCsv({ data: { kind, content } });
      setPreview({ kind, filename: file.name, content, result });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Validasi gagal");
    } finally {
      setValidating(null);
    }
  }

  async function handleConfirmImport() {
    if (!preview) return;
    setImporting(preview.kind);
    try {
      const skipRows = preview.result.rows
        .filter((r) => r.status === "error")
        .map((r) => r.rowNumber - 2); // Convert to 0-indexed
      const result = await importCsv({
        data: {
          kind: preview.kind,
          filename: preview.filename,
          content: preview.content,
          skipRows,
        },
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setPreview(null);
      router.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import gagal");
    } finally {
      setImporting(null);
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h2 className="font-display text-2xl font-bold">Import & Export Data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ekspor data ke Excel/CSV/PDF atau impor data massal dari file.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" /> Export Data
          </h3>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-md border border-border bg-input/40 px-3 py-1.5 text-sm"
          >
            <option value="hari-ini">Hari Ini</option>
            <option value="minggu-ini">Minggu Ini</option>
            <option value="bulan-ini">Bulan Ini</option>
            <option value="3-bulan">3 Bulan Terakhir</option>
            <option value="kustom">Periode Kustom</option>
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {exportItems.map((it) => (
            <div
              key={it.title}
              className="rounded-xl border border-border bg-card p-4 flex items-start gap-4"
            >
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 text-primary shrink-0">
                <it.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-medium">{it.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{it.desc}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {it.formats.map((fmt) => (
                    <button
                      key={fmt}
                      disabled={downloading === `${it.kind}-${fmt}`}
                      onClick={() => handleExport(it.kind, fmt)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {fmt === "PDF" ? (
                        <FileText className="h-3.5 w-3.5" />
                      ) : (
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                      )}
                      {downloading === `${it.kind}-${fmt}` ? "Menyiapkan..." : fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" /> Import Data
        </h3>
        <div className="grid gap-3 md:grid-cols-2">
          {importItems.map((it) => (
            <div key={it.title} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-accent text-foreground shrink-0">
                  <it.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{it.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{it.desc}</div>
                </div>
              </div>
              <label className="block rounded-lg border-2 border-dashed border-border p-5 text-center hover:border-primary/40 hover:bg-accent/30 cursor-pointer">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  disabled={importing === it.kind}
                  onChange={(event) => {
                    handleImport(it.kind, event.currentTarget.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
                <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                <div className="mt-2 text-sm">
                  {importing === it.kind ? (
                    "Mengimpor file..."
                  ) : validating === it.kind ? (
                    "Memvalidasi..."
                  ) : (
                    <>
                      Tarik file ke sini atau{" "}
                      <span className="text-primary font-medium">pilih file</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">CSV maks 5 MB</div>
              </label>
              <div className="flex items-center justify-between text-xs">
                <button
                  onClick={() =>
                    downloadFile(it.template, it.templateContent, "text/csv;charset=utf-8")
                  }
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Download className="h-3 w-3" /> Unduh template
                </button>
                <span className="text-muted-foreground">Format: CSV (UTF-8)</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Preview Section */}
      {preview && (
        <section className="space-y-3">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Preview Import
          </h3>
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="rounded-full bg-success/15 text-success px-3 py-1 font-medium">
                {preview.result.summary.ok} OK
              </span>
              {preview.result.summary.warn > 0 && (
                <span className="rounded-full bg-warning/15 text-warning px-3 py-1 font-medium">
                  {preview.result.summary.warn} Peringatan
                </span>
              )}
              {preview.result.summary.error > 0 && (
                <span className="rounded-full bg-destructive/15 text-destructive px-3 py-1 font-medium">
                  {preview.result.summary.error} Error
                </span>
              )}
              <span className="text-muted-foreground text-xs">
                dari {preview.result.summary.total} baris total
              </span>
            </div>
            <div className="max-h-72 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-accent/50 text-left uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Data</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.result.rows.slice(0, 100).map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={
                        row.status === "error"
                          ? "bg-destructive/5"
                          : row.status === "warn"
                            ? "bg-warning/5"
                            : ""
                      }
                    >
                      <td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td>
                      <td className="px-3 py-2 max-w-xs truncate">
                        {Object.values(row.data).slice(0, 3).join(" · ")}
                      </td>
                      <td className="px-3 py-2">
                        {row.status === "error" ? (
                          <span className="text-destructive">{row.messages.join("; ")}</span>
                        ) : row.status === "warn" ? (
                          <span className="text-warning">{row.messages.join("; ")}</span>
                        ) : (
                          <span className="text-success">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.result.rows.length > 100 && (
                <div className="px-3 py-2 text-center text-xs text-muted-foreground border-t border-border">
                  Menampilkan 100 dari {preview.result.rows.length} baris
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPreview(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={
                  importing !== null ||
                  preview.result.summary.ok + preview.result.summary.warn === 0
                }
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {importing
                  ? "Mengimpor..."
                  : `Import ${preview.result.summary.ok + preview.result.summary.warn} baris yang valid`}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="font-display text-lg font-semibold">Riwayat Aktivitas</h3>
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {recent.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 p-4">
              <div
                className={`grid h-9 w-9 place-items-center rounded-lg ${r.status === "success" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}
              >
                {r.status === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.target || r.action}</div>
                <div className="text-xs text-muted-foreground">
                  {r.type === "export" ? "Export" : "Import"} ·{" "}
                  {new Date(r.occurredAt).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </div>
              </div>
              <div className="text-xs text-muted-foreground text-right">{r.detail}</div>
            </div>
          ))}
          {!recent.length && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Belum ada aktivitas import/export untuk tenant ini.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
