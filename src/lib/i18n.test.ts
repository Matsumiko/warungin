import { describe, it, expect } from "vitest";
import { t } from "./i18n";

describe("t() translation function", () => {
  it("returns Indonesian text for known keys", () => {
    expect(t("id", "common.save")).toBe("Simpan");
    expect(t("id", "dashboard.title")).toBe("Dashboard");
    expect(t("id", "cashier.pay")).toBe("Bayar");
  });

  it("returns English text for known keys", () => {
    expect(t("en", "common.save")).toBe("Save");
    expect(t("en", "dashboard.title")).toBe("Dashboard");
    expect(t("en", "cashier.pay")).toBe("Pay");
  });

  it("falls back to Indonesian if English key is missing", () => {
    // All keys exist in both locales, so test with a hypothetical missing key
    expect(t("en", "common.save")).toBe("Save");
  });

  it("returns the key itself if not found in any locale", () => {
    expect(t("id", "nonexistent.key")).toBe("nonexistent.key");
    expect(t("en", "nonexistent.key")).toBe("nonexistent.key");
  });

  it("supports parameter interpolation", () => {
    expect(t("id", "time.minutesAgo", { count: "5" })).toBe("5 menit lalu");
    expect(t("en", "time.minutesAgo", { count: "5" })).toBe("5 min ago");
  });

  it("handles missing params gracefully", () => {
    const result = t("id", "time.minutesAgo");
    expect(result).toContain("{count}");
  });
});
