import { describe, it, expect, vi } from "vitest";

describe("csrf", () => {
  describe("generateCsrfToken", () => {
    it("returns a 64-char hex string", async () => {
      const { generateCsrfToken } = await import("./csrf");
      const token = await generateCsrfToken();
      expect(token).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });

    it("generates unique tokens", async () => {
      const { generateCsrfToken } = await import("./csrf");
      const t1 = await generateCsrfToken();
      const t2 = await generateCsrfToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe("validateCsrf", () => {
    it("returns false when no request context", async () => {
      const { validateCsrf } = await import("./csrf");
      // No request context available in test — should hit catch block
      expect(await validateCsrf()).toBe(false);
    });
  });
});
