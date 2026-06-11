/**
 * Pure utility functions extracted from backoffice.ts.
 * No server-only dependencies — safe for client+server bundles.
 */

export type ExportFormat = "CSV" | "Excel" | "PDF";
export type ExportKind = "products" | "transactions" | "shifts" | "stock";

export function on(value: string | undefined) {
  return value === "1" || value === "true";
}

export function toRate(value: string | undefined) {
  const rate = Number(value ?? 0);
  if (!Number.isFinite(rate)) return 0;
  return Math.max(0, Math.min(100, rate));
}

export function calculateTransactionTotals(subtotal: number, settings: Record<string, string>) {
  const taxRate = toRate(settings.taxRate);
  const serviceRate = toRate(settings.serviceCharge);
  const inclusiveTax = settings.taxMode === "inclusive";
  const tax =
    on(settings.taxEnabled) && taxRate > 0
      ? inclusiveTax
        ? Math.round((subtotal * taxRate) / (100 + taxRate))
        : Math.round((subtotal * taxRate) / 100)
      : 0;
  const serviceCharge = serviceRate > 0 ? Math.round((subtotal * serviceRate) / 100) : 0;
  return {
    tax,
    serviceCharge,
    total: subtotal + serviceCharge + (inclusiveTax ? 0 : tax),
  };
}

export function csvEscape(value: string | number | null | undefined) {
  const raw = String(value ?? "");
  if (/[",\n\r]/.test(raw)) return `"${raw.replaceAll('"', '""')}"`;
  return raw;
}

export function rowsToDelimited(rows: Array<Record<string, string | number>>, delimiter = ",") {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.map((header) => csvEscape(header)).join(delimiter),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(delimiter)),
  ].join("\n");
}

export function parseCsv(content: string) {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n") {
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function csvRecords(content: string) {
  const rows = parseCsv(content);
  const headers = rows.shift()?.map((header) => header.trim().toLowerCase().replace(/\s+/g, "_"));
  if (!headers?.length) return [];
  return rows.map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index]?.trim() ?? "";
    });
    return record;
  });
}

export function toInt(value: string | undefined, fallback = 0) {
  const normalized = String(value ?? "").replace(/[^\d-]/g, "");
  const number = Number(normalized || fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.round(number));
}

export function pdfEscape(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export function makeSimplePdf(title: string, lines: string[]) {
  const pageLines = [title, "", ...lines].slice(0, 42);
  const text = pageLines
    .map((line, index) => `BT /F1 10 Tf 40 ${780 - index * 16} Td (${pdfEscape(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${text.length} >> stream\n${text}\nendstream endobj`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += `${object}\n`;
  }
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
    .join("\n");
  body += `\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return body;
}

export function periodClause(period: string, column: string) {
  if (period === "hari-ini")
    return { sql: ` AND date(${column}) = date('now', 'localtime')`, args: [] };
  if (period === "minggu-ini")
    return { sql: ` AND ${column} >= datetime('now', '-7 days')`, args: [] };
  if (period === "3-bulan")
    return { sql: ` AND ${column} >= datetime('now', '-3 months')`, args: [] };
  return { sql: ` AND ${column} >= datetime('now', 'start of month')`, args: [] };
}

export function exportLabel(kind: ExportKind) {
  return (
    {
      products: "Produk",
      transactions: "Transaksi",
      shifts: "Laporan Shift",
      stock: "Stok & Mutasi",
    } as Record<string, string>
  )[kind];
}

export function exportFilename(kind: ExportKind, format: ExportFormat) {
  const ext = format === "Excel" ? "xls" : format.toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);
  return `warungin-${kind}-${stamp}.${ext}`;
}
