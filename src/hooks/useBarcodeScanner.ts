import { useEffect, useRef, useState, useCallback } from "react";

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minLength?: number;
  maxLength?: number;
  maxInputDuration?: number;
  maxKeyGap?: number;
}

interface UseBarcodeScannerReturn {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isScanning: boolean;
  lastScanResult: { barcode: string; found: boolean; productName?: string } | null;
  clearScanResult: () => void;
}

/**
 * Detects barcode scanner input using timing heuristic.
 *
 * Barcode scanners simulate keyboard input at very high speed:
 * - All characters arrive within ~50-150ms
 * - Followed by Enter key
 *
 * Manual typing has inter-key gaps > 200ms, so it never triggers the scanner path.
 */
export function useBarcodeScanner(options: UseBarcodeScannerOptions): UseBarcodeScannerReturn {
  const {
    onScan,
    minLength = 4,
    maxLength = 30,
    maxInputDuration = 500,
    maxKeyGap = 200,
  } = options;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{
    barcode: string;
    found: boolean;
    productName?: string;
  } | null>(null);

  // Refs for tracking timing
  const charBufferRef = useRef<string[]>([]);
  const firstKeyTimeRef = useRef<number>(0);
  const lastKeyTimeRef = useRef<number>(0);

  const clearScanResult = useCallback(() => {
    setLastScanResult(null);
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore modifier keys, function keys, etc.
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key.length > 1 && e.key !== "Enter" && e.key !== "Backspace") return;

      const now = Date.now();

      if (e.key === "Enter") {
        const buffer = charBufferRef.current;
        const elapsed = now - firstKeyTimeRef.current;
        if (
          buffer.length >= minLength &&
          buffer.length <= maxLength &&
          elapsed <= maxInputDuration
        ) {
          const barcode = buffer.join("");
          setIsScanning(true);
          onScan(barcode);
          // Reset after a brief delay so the UI can show feedback
          setTimeout(() => setIsScanning(false), 100);
        }
        charBufferRef.current = [];
        return;
      }

      if (e.key === "Backspace") {
        charBufferRef.current.pop();
        return;
      }

      // Single character
      const gap = now - lastKeyTimeRef.current;
      if (gap > maxKeyGap && charBufferRef.current.length > 0) {
        // Too long gap — this is manual typing, reset buffer
        charBufferRef.current = [];
      }

      if (charBufferRef.current.length === 0) {
        firstKeyTimeRef.current = now;
      }

      charBufferRef.current.push(e.key);
      lastKeyTimeRef.current = now;
    }

    input.addEventListener("keydown", handleKeyDown);
    return () => input.removeEventListener("keydown", handleKeyDown);
  }, [onScan, minLength, maxLength, maxInputDuration, maxKeyGap]);

  return { inputRef, isScanning, lastScanResult, clearScanResult };
}
