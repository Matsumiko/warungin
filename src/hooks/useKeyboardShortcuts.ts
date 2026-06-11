import { useEffect, useRef } from "react";

interface KeyboardShortcutHandlers {
  onSearchFocus?: () => void;
  onScannerFocus?: () => void;
  onHoldOrder?: () => void;
  onVoidAll?: () => void;
  onOpenCheckout?: () => void;
  onRecallHeld?: () => void;
  onCloseCheckout?: () => void;
}

/**
 * Global keyboard shortcuts for the cashier POS screen.
 * Ignores events when the user is typing in an input/textarea/select.
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in a form field
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        // Only allow Escape in form fields
        if (e.key === "Escape") {
          handlersRef.current.onCloseCheckout?.();
        }
        return;
      }

      switch (e.key) {
        case "F1":
          e.preventDefault();
          handlersRef.current.onSearchFocus?.();
          break;
        case "F2":
          e.preventDefault();
          handlersRef.current.onScannerFocus?.();
          break;
        case "F3":
          e.preventDefault();
          handlersRef.current.onHoldOrder?.();
          break;
        case "F4":
          e.preventDefault();
          handlersRef.current.onVoidAll?.();
          break;
        case "F5":
          e.preventDefault();
          handlersRef.current.onOpenCheckout?.();
          break;
        case "F9":
          e.preventDefault();
          handlersRef.current.onRecallHeld?.();
          break;
        case "Escape":
          handlersRef.current.onCloseCheckout?.();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
