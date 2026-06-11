import { createFileRoute, redirect } from "@tanstack/react-router";
import { QrCode } from "lucide-react";
import { getReceipt, getTenantSettings } from "@/lib/backoffice";
import { getCurrentUser } from "@/lib/auth";
import { canAccessStandalonePath, roleHomePath } from "@/lib/auth-utils";
import { formatIDR, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/print/receipt/$id")({
  head: () => ({ meta: [{ title: "Cetak Struk" }] }),
  beforeLoad: async () => {
    const session = await getCurrentUser();
    if (!session) throw redirect({ to: "/login" });
    if (!canAccessStandalonePath(session.role, "/print")) {
      throw redirect({ to: roleHomePath(session.role) });
    }
  },
  loader: async ({ params }) => {
    const [receipt, tenantSettings] = await Promise.all([
      getReceipt({ data: params.id }),
      getTenantSettings(),
    ]);
    return { receipt, tenantSettings };
  },
  component: PrintReceipt,
});

function isOn(value: string | undefined) {
  return value === "1" || value === "true";
}

function paperWidthClass(paper: string | undefined) {
  if (paper === "58mm") return "w-[210px]";
  if (paper === "A4") return "w-full max-w-[794px]";
  return "w-[300px]"; // 80mm default
}

function PrintReceipt() {
  const { id } = Route.useParams();
  const { receipt, tenantSettings } = Route.useLoaderData();
  const settings = tenantSettings.settings;
  const taxRate = Number(settings.taxRate ?? 0);
  const serviceRate = Number(settings.serviceCharge ?? 0);
  const inclusive = settings.taxMode === "inclusive";
  const receiptTitle = settings.receiptHeader || tenantSettings.storeName || "WARUNGIN";
  const footerLines = (settings.receiptFooter || "Terima kasih").split("\n");

  const showLogo = isOn(settings.receiptShowLogo);
  const showCashier = isOn(settings.receiptShowCashier);
  const showQr = isOn(settings.receiptShowQr);

  if (!receipt) {
    return (
      <div className="grid min-h-screen place-items-center bg-neutral-300 p-6">
        <div className="rounded-lg bg-white p-6 text-sm text-black">Struk tidak ditemukan.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-neutral-300 p-6 print:bg-white print:p-0">
      <div
        className={`${paperWidthClass(settings.receiptPaper)} print-receipt bg-white text-black p-4 text-xs font-mono shadow-2xl print:shadow-none`}
      >
        <div className="text-center">
          {showLogo ? (
            <div className="font-bold text-base">{receiptTitle}</div>
          ) : (
            <div className="font-bold text-sm">{receiptTitle}</div>
          )}
        </div>
        <div className="my-2 border-t border-dashed border-black" />
        <div className="flex justify-between">
          <span>No. Trx:</span>
          <span>{id}</span>
        </div>
        <div className="flex justify-between">
          <span>Tanggal:</span>
          <span>{new Date(receipt.createdAt).toLocaleString("id-ID")}</span>
        </div>
        {showCashier && (
          <div className="flex justify-between">
            <span>Kasir:</span>
            <span>{receipt.cashierName || "-"}</span>
          </div>
        )}
        <div className="my-2 border-t border-dashed border-black" />
        {receipt.items.map((i, idx) => (
          <div key={idx} className="mb-1">
            <div>{i.name}</div>
            <div className="flex justify-between">
              <span>
                {formatNumber(i.qty)} × {formatNumber(i.price)}
              </span>
              <span>{formatNumber(i.qty * i.price)}</span>
            </div>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-black" />
        <Row label="Subtotal" value={formatNumber(receipt.subtotal)} />
        {receipt.tax > 0 && (
          <Row
            label={inclusive ? `PPN ${taxRate}% (incl.)` : `PPN ${taxRate}%`}
            value={formatNumber(receipt.tax)}
          />
        )}
        {receipt.serviceCharge > 0 && (
          <Row label={`Service ${serviceRate}%`} value={formatNumber(receipt.serviceCharge)} />
        )}
        <Row label="TOTAL" value={formatNumber(receipt.total)} bold />
        <div className="my-2 border-t border-dashed border-black" />
        <Row label="Cash" value={formatNumber(receipt.cashReceived)} />
        <Row label="Kembali" value={formatNumber(receipt.cashReceived - receipt.total)} />
        {showQr && (
          <>
            <div className="my-3 border-t border-dashed border-black" />
            <div className="grid place-items-center">
              <QrCode className="h-16 w-16" />
            </div>
          </>
        )}
        <div className="mt-3 text-center">
          {footerLines.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </div>
      </div>
      <button
        onClick={() => window.print()}
        className="fixed bottom-6 right-6 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg print:hidden"
      >
        Cetak Struk
      </button>
      <div className="fixed bottom-6 left-6 text-xs text-neutral-700 print:hidden">
        Total: {formatIDR(receipt.total)}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-sm" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
