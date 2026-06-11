import { describe, it, expect, vi } from "vitest";

describe("auth pure helpers", () => {
  async function loadHelpers() {
    const mod = await import("./auth-utils");
    return {
      normalizeRole: mod.normalizeRole,
      normalizeEmail: mod.normalizeEmail,
      roleHomePath: mod.roleHomePath,
      canAccessAppPath: mod.canAccessAppPath,
      canAccessStandalonePath: mod.canAccessStandalonePath,
      hasAnyRole: mod.hasAnyRole,
      hashPassword: mod.hashPassword,
      verifyPassword: mod.verifyPassword,
    };
  }

  describe("normalizeRole", () => {
    it("returns owner for unknown roles", async () => {
      const { normalizeRole } = await loadHelpers();
      expect(normalizeRole("admin")).toBe("owner");
      expect(normalizeRole("superadmin")).toBe("owner");
      expect(normalizeRole("")).toBe("owner");
    });

    it("preserves known roles", async () => {
      const { normalizeRole } = await loadHelpers();
      expect(normalizeRole("manager")).toBe("manager");
      expect(normalizeRole("kasir")).toBe("kasir");
      expect(normalizeRole("gudang")).toBe("gudang");
      expect(normalizeRole("display")).toBe("display");
      expect(normalizeRole("owner")).toBe("owner");
    });
  });

  describe("roleHomePath", () => {
    it("returns correct path per role", async () => {
      const { roleHomePath } = await loadHelpers();
      expect(roleHomePath("owner")).toBe("/dashboard");
      expect(roleHomePath("manager")).toBe("/dashboard");
      expect(roleHomePath("kasir")).toBe("/cashier");
      expect(roleHomePath("gudang")).toBe("/inventory");
      expect(roleHomePath("display")).toBe("/customer-display");
    });

    it("falls back to /dashboard for unknown role", async () => {
      const { roleHomePath } = await loadHelpers();
      expect(roleHomePath("unknown")).toBe("/dashboard");
    });
  });

  describe("canAccessAppPath", () => {
    it("owner and manager can access dashboard", async () => {
      const { canAccessAppPath } = await loadHelpers();
      expect(canAccessAppPath("owner", "/dashboard")).toBe(true);
      expect(canAccessAppPath("manager", "/dashboard")).toBe(true);
      expect(canAccessAppPath("kasir", "/dashboard")).toBe(false);
    });

    it("kasir can access customers and promotions", async () => {
      const { canAccessAppPath } = await loadHelpers();
      expect(canAccessAppPath("kasir", "/customers")).toBe(true);
      expect(canAccessAppPath("kasir", "/promotions")).toBe(true);
    });

    it("kasir cannot access products or inventory", async () => {
      const { canAccessAppPath } = await loadHelpers();
      expect(canAccessAppPath("kasir", "/products")).toBe(false);
      expect(canAccessAppPath("kasir", "/inventory")).toBe(false);
    });

    it("gudang can access products and inventory", async () => {
      const { canAccessAppPath } = await loadHelpers();
      expect(canAccessAppPath("gudang", "/products")).toBe(true);
      expect(canAccessAppPath("gudang", "/inventory")).toBe(true);
      expect(canAccessAppPath("gudang", "/customers")).toBe(false);
    });

    it("owner/manager can access any unmatched path", async () => {
      const { canAccessAppPath } = await loadHelpers();
      expect(canAccessAppPath("owner", "/some-unknown-page")).toBe(true);
      expect(canAccessAppPath("manager", "/some-unknown-page")).toBe(true);
      expect(canAccessAppPath("kasir", "/some-unknown-page")).toBe(false);
    });

    it("matches nested paths", async () => {
      const { canAccessAppPath } = await loadHelpers();
      expect(canAccessAppPath("gudang", "/products/abc123")).toBe(true);
      expect(canAccessAppPath("kasir", "/products/abc123")).toBe(false);
    });
  });

  describe("canAccessStandalonePath", () => {
    it("owner, manager, kasir can access cashier", async () => {
      const { canAccessStandalonePath } = await loadHelpers();
      expect(canAccessStandalonePath("owner", "/cashier")).toBe(true);
      expect(canAccessStandalonePath("manager", "/cashier")).toBe(true);
      expect(canAccessStandalonePath("kasir", "/cashier")).toBe(true);
    });

    it("gudang cannot access cashier", async () => {
      const { canAccessStandalonePath } = await loadHelpers();
      expect(canAccessStandalonePath("gudang", "/cashier")).toBe(false);
    });

    it("display can access customer-display", async () => {
      const { canAccessStandalonePath } = await loadHelpers();
      expect(canAccessStandalonePath("display", "/customer-display")).toBe(true);
    });

    it("kasir can access customer-display", async () => {
      const { canAccessStandalonePath } = await loadHelpers();
      expect(canAccessStandalonePath("kasir", "/customer-display")).toBe(true);
    });
  });

  describe("hasAnyRole", () => {
    it("returns true when role is in the list", async () => {
      const { hasAnyRole } = await loadHelpers();
      expect(hasAnyRole("kasir", ["owner", "kasir"])).toBe(true);
    });

    it("returns false when role is not in the list", async () => {
      const { hasAnyRole } = await loadHelpers();
      expect(hasAnyRole("gudang", ["owner", "kasir"])).toBe(false);
    });
  });

  describe("hashPassword and verifyPassword", () => {
    it("roundtrips correctly", async () => {
      const { hashPassword, verifyPassword } = await loadHelpers();
      const password = "TestPassword123!";
      const stored = await hashPassword(password);

      expect(stored).toMatch(/^scrypt:[0-9a-f]+:[0-9a-f]+$/);
      expect(await verifyPassword(password, stored)).toBe(true);
    });

    it("rejects wrong password", async () => {
      const { hashPassword, verifyPassword } = await loadHelpers();
      const stored = await hashPassword("correct-password");
      expect(await verifyPassword("wrong-password", stored)).toBe(false);
    });

    it("rejects malformed stored hash", async () => {
      const { verifyPassword } = await loadHelpers();
      expect(await verifyPassword("password", "not-a-hash")).toBe(false);
      expect(await verifyPassword("password", "scrypt:abc:def")).toBe(false);
    });
  });

  describe("normalizeEmail", () => {
    it("trims and lowercases", async () => {
      const { normalizeEmail } = await loadHelpers();
      expect(normalizeEmail("  TEST@Example.COM  ")).toBe("test@example.com");
    });
  });
});
