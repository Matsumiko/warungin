import { createContext, useContext } from "react";

export type Locale = "id" | "en";

// Translation dictionaries
import { id } from "./locales/id";
import { en } from "./locales/en";

const dictionaries: Record<Locale, Record<string, string>> = { id, en };

// React context for the current locale
export const LocaleContext = createContext<Locale>("id");

/**
 * Get a translated string by key. Falls back to Indonesian if missing.
 * Supports simple param interpolation: t("hello", { name: "World" }) → "Hello World"
 */
export function t(locale: Locale, key: string, params?: Record<string, string | number>): string {
  let value = dictionaries[locale]?.[key] ?? dictionaries.id[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return value;
}

/**
 * Hook to get a translation function bound to the current locale.
 */
export function useTranslation() {
  const locale = useContext(LocaleContext);
  return {
    locale,
    t: (key: string, params?: Record<string, string | number>) => t(locale, key, params),
  };
}
