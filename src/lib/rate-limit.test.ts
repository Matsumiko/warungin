import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need fresh module state for each test group since rate-limit uses module-level Maps.
// Using vi.resetModules() in the innermost describe blocks.

describe("rate-limit", () => {
  describe("checkRateLimit", () => {
    let checkRateLimit: typeof import("./rate-limit").checkRateLimit;

    beforeEach(async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.resetModules();
      const mod = await import("./rate-limit");
      checkRateLimit = mod.checkRateLimit;
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("allows first request", () => {
      const result = checkRateLimit("test-key", 5, 60_000);
      expect(result.ok).toBe(true);
    });

    it("allows requests within limit", () => {
      for (let i = 0; i < 5; i++) {
        expect(checkRateLimit("test-key", 5, 60_000).ok).toBe(true);
      }
    });

    it("blocks when limit exceeded", () => {
      for (let i = 0; i < 5; i++) {
        checkRateLimit("test-key", 5, 60_000);
      }
      const result = checkRateLimit("test-key", 5, 60_000);
      expect(result.ok).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("allows again after window expires", () => {
      for (let i = 0; i < 5; i++) {
        checkRateLimit("test-key", 5, 60_000);
      }
      expect(checkRateLimit("test-key", 5, 60_000).ok).toBe(false);

      vi.advanceTimersByTime(60_001);

      const result = checkRateLimit("test-key", 5, 60_000);
      expect(result.ok).toBe(true);
    });

    it("different keys are independent", () => {
      for (let i = 0; i < 5; i++) {
        checkRateLimit("key-a", 5, 60_000);
      }
      expect(checkRateLimit("key-a", 5, 60_000).ok).toBe(false);
      expect(checkRateLimit("key-b", 5, 60_000).ok).toBe(true);
    });
  });

  describe("checkLoginRateLimit", () => {
    let checkLoginRateLimit: typeof import("./rate-limit").checkLoginRateLimit;

    beforeEach(async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.resetModules();
      const mod = await import("./rate-limit");
      checkLoginRateLimit = mod.checkLoginRateLimit;
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("allows normal login attempt", () => {
      const result = checkLoginRateLimit("192.168.1.1", "user@test.com");
      expect(result.ok).toBe(true);
    });

    it("blocks after 5 attempts from same IP", () => {
      for (let i = 0; i < 5; i++) {
        checkLoginRateLimit("192.168.1.1", "user@test.com");
      }
      const result = checkLoginRateLimit("192.168.1.1", "other@test.com");
      expect(result.ok).toBe(false);
    });

    it("blocks after 10 attempts with same email", () => {
      for (let i = 0; i < 10; i++) {
        checkLoginRateLimit(`10.0.0.${i}`, "user@test.com");
      }
      const result = checkLoginRateLimit("10.0.0.100", "user@test.com");
      expect(result.ok).toBe(false);
    });

    it("different IPs and emails are independent", () => {
      for (let i = 0; i < 5; i++) {
        checkLoginRateLimit("192.168.1.1", "a@test.com");
      }
      expect(checkLoginRateLimit("192.168.1.1", "b@test.com").ok).toBe(false);
      expect(checkLoginRateLimit("192.168.1.2", "a@test.com").ok).toBe(true);
    });
  });

  describe("account lockout", () => {
    let isAccountLocked: typeof import("./rate-limit").isAccountLocked;
    let recordFailedLogin: typeof import("./rate-limit").recordFailedLogin;
    let clearFailedLogins: typeof import("./rate-limit").clearFailedLogins;

    beforeEach(async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.resetModules();
      const mod = await import("./rate-limit");
      isAccountLocked = mod.isAccountLocked;
      recordFailedLogin = mod.recordFailedLogin;
      clearFailedLogins = mod.clearFailedLogins;
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("account is not locked initially", () => {
      expect(isAccountLocked("user@test.com").locked).toBe(false);
    });

    it("locks after 10 failed attempts", () => {
      for (let i = 0; i < 10; i++) {
        recordFailedLogin("user@test.com");
      }
      expect(isAccountLocked("user@test.com").locked).toBe(true);
    });

    it("unlocks after lockout duration expires", () => {
      for (let i = 0; i < 10; i++) {
        recordFailedLogin("user@test.com");
      }
      expect(isAccountLocked("user@test.com").locked).toBe(true);

      vi.advanceTimersByTime(15 * 60 * 1000 + 1);

      expect(isAccountLocked("user@test.com").locked).toBe(false);
    });

    it("clearFailedLogins resets the counter", () => {
      for (let i = 0; i < 9; i++) {
        recordFailedLogin("user@test.com");
      }
      clearFailedLogins("user@test.com");
      expect(isAccountLocked("user@test.com").locked).toBe(false);
    });

    it("different emails have independent lockout state", () => {
      for (let i = 0; i < 10; i++) {
        recordFailedLogin("a@test.com");
      }
      expect(isAccountLocked("a@test.com").locked).toBe(true);
      expect(isAccountLocked("b@test.com").locked).toBe(false);
    });

    it("retryAfter is provided when locked", () => {
      for (let i = 0; i < 10; i++) {
        recordFailedLogin("user@test.com");
      }
      const result = isAccountLocked("user@test.com");
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });
});
