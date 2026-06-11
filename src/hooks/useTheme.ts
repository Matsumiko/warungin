import { useEffect, useCallback } from "react";

export type ThemeMode = "dark-navy" | "light" | "auto";

const STORAGE_KEY = "warungin-theme";

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolveTheme(mode: ThemeMode): "dark" | "light" {
  if (mode === "light") return "light";
  if (mode === "auto") return getSystemTheme();
  return "dark"; // "dark-navy"
}

function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(resolved);

  // Also update sidebar colors for light mode
  const sidebar = root.querySelector<HTMLElement>("aside");
  if (sidebar) {
    sidebar.classList.remove("dark", "light");
    sidebar.classList.add(resolved);
  }
}

/**
 * Reads theme from localStorage (for instant load) and applies it.
 * Call this once in the app layout to avoid flash of wrong theme.
 */
export function useTheme(mode: ThemeMode = "dark-navy") {
  // Apply theme from localStorage immediately (before first paint)
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode) || mode;
    applyTheme(stored);
  }, [mode]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (mode !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => applyTheme("auto");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);
}

/**
 * Save theme preference and apply immediately.
 * Use this from the settings page when user changes theme.
 */
export function setTheme(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode);
  applyTheme(mode);
}
