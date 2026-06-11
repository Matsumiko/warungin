import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

export interface StockChangedData {
  productId: string;
  productName: string;
  newStock: number;
  oldStock: number;
}

export interface TransactionCompletedData {
  transactionId: string;
  total: number;
  paymentMethod: string;
  cashierName: string;
  itemCount: number;
}

export interface LowStockData {
  productId: string;
  productName: string;
  currentStock: number;
  minStock: number;
}

export interface ShiftOpenedData {
  shiftId: string;
  cashierName: string;
  outletName: string;
  openingCash: number;
}

export interface ShiftClosedData {
  shiftId: string;
  cashierName: string;
  expectedCash: number;
  actualCash: number;
  diff: number;
}

export interface NotificationCreatedData {
  id: string;
  title: string;
  severity: string;
  type: string;
}

interface UseRealtimeEventsOptions {
  onStockChanged?: (data: StockChangedData) => void;
  onTransactionCompleted?: (data: TransactionCompletedData) => void;
  onLowStock?: (data: LowStockData) => void;
  onShiftOpened?: (data: ShiftOpenedData) => void;
  onShiftClosed?: (data: ShiftClosedData) => void;
  onNotificationCreated?: (data: NotificationCreatedData) => void;
}

type ConnectionState = "connected" | "disconnected" | "reconnecting";

export function useRealtimeEvents(options?: UseRealtimeEventsOptions): {
  connectionState: ConnectionState;
} {
  const router = useRouter();
  const [connectionState, setConnectionState] = useState<ConnectionState>("reconnecting");
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const invalidateRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scheduleInvalidate = useCallback(() => {
    clearTimeout(invalidateRef.current);
    invalidateRef.current = setTimeout(() => {
      router.invalidate();
    }, 300);
  }, [router]);

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.onopen = () => setConnectionState("connected");
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setConnectionState("disconnected");
      } else {
        setConnectionState("reconnecting");
      }
    };

    es.addEventListener("stock.changed", ((e: MessageEvent) => {
      const data = JSON.parse(e.data) as StockChangedData;
      optionsRef.current?.onStockChanged?.(data);
      scheduleInvalidate();
    }) as EventListener);

    es.addEventListener("transaction.completed", ((e: MessageEvent) => {
      const data = JSON.parse(e.data) as TransactionCompletedData;
      optionsRef.current?.onTransactionCompleted?.(data);
    }) as EventListener);

    es.addEventListener("low.stock", ((e: MessageEvent) => {
      const data = JSON.parse(e.data) as LowStockData;
      optionsRef.current?.onLowStock?.(data);
      toast.warning(`Stok ${data.productName} rendah: ${data.currentStock}`);
    }) as EventListener);

    es.addEventListener("shift.opened", ((e: MessageEvent) => {
      const data = JSON.parse(e.data) as ShiftOpenedData;
      optionsRef.current?.onShiftOpened?.(data);
    }) as EventListener);

    es.addEventListener("shift.closed", ((e: MessageEvent) => {
      const data = JSON.parse(e.data) as ShiftClosedData;
      optionsRef.current?.onShiftClosed?.(data);
    }) as EventListener);

    es.addEventListener("notification.created", ((e: MessageEvent) => {
      const data = JSON.parse(e.data) as NotificationCreatedData;
      optionsRef.current?.onNotificationCreated?.(data);
      const severityIcon =
        data.severity === "error"
          ? "❌"
          : data.severity === "warning"
            ? "⚠️"
            : data.severity === "success"
              ? "✅"
              : "ℹ️";
      toast(`${severityIcon} ${data.title}`);
      scheduleInvalidate();
    }) as EventListener);

    return () => {
      clearTimeout(invalidateRef.current);
      es.close();
    };
  }, [scheduleInvalidate]);

  return { connectionState };
}
