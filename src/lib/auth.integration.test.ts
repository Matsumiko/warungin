import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomBytes, scryptSync } from "node:crypto";

// --- Mock DB ---
const mockExecute = vi.fn();
const mockBatch = vi.fn();

vi.mock("./db/turso.server", () => ({
  getTursoClient: () => ({ execute: mockExecute, batch: mockBatch }),
}));

// --- Mock request context ---
vi.mock("@tanstack/start-server-core", () => ({
  getRequestIP: vi.fn(() => "192.168.1.1"),
}));

// --- Mock cookies ---
vi.mock("@tanstack/react-start/server", () => ({
  getCookie: vi.fn(() => "mock-session-id"),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));

// --- Mock rate-limit ---
vi.mock("./rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ ok: true, retryAfter: 0 })),
  checkLoginRateLimit: vi.fn(() => ({ ok: true, retryAfter: 0 })),
  isAccountLocked: vi.fn(() => ({ locked: false, retryAfter: 0 })),
  recordFailedLogin: vi.fn(),
  clearFailedLogins: vi.fn(),
}));

// --- Helpers ---
function makeUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "usr_abc123",
    tenant_id: "ten_abc123",
    name: "Test User",
    email: "test@example.com",
    role: "owner",
    password_hash: "",
    pin_hash: "",
    active: 1,
    ...overrides,
  };
}

function makeScryptHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

// --- Tests ---

describe("loginWithEmailHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error on locked account", async () => {
    const { isAccountLocked } = await import("./rate-limit");
    vi.mocked(isAccountLocked).mockReturnValue({ locked: true, retryAfter: 300 });

    const { loginWithEmailHandler } = await import("./auth");
    const result = await loginWithEmailHandler({
      email: "locked@example.com",
      password: "pass1234",
    });
    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("Akun terkunci"),
      home: "/login",
    });
  });

  it("returns error on rate limit", async () => {
    const { isAccountLocked, checkLoginRateLimit } = await import("./rate-limit");
    vi.mocked(isAccountLocked).mockReturnValue({ locked: false, retryAfter: 0 });
    vi.mocked(checkLoginRateLimit).mockReturnValue({ ok: false, retryAfter: 120 });

    const { loginWithEmailHandler } = await import("./auth");
    const result = await loginWithEmailHandler({ email: "test@example.com", password: "pass1234" });
    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("Terlalu banyak"),
      home: "/login",
    });
  });

  it("returns error on wrong password", async () => {
    const { isAccountLocked, checkLoginRateLimit, recordFailedLogin } =
      await import("./rate-limit");
    vi.mocked(isAccountLocked).mockReturnValue({ locked: false, retryAfter: 0 });
    vi.mocked(checkLoginRateLimit).mockReturnValue({ ok: true });
    vi.mocked(recordFailedLogin).mockReturnValue(undefined);

    mockExecute.mockResolvedValueOnce({
      rows: [makeUserRow({ password_hash: makeScryptHash("correctpass") })],
    });

    const { loginWithEmailHandler } = await import("./auth");
    const result = await loginWithEmailHandler({
      email: "test@example.com",
      password: "wrongpass",
    });
    expect(result).toEqual({ ok: false, message: "Email atau password salah.", home: "/login" });
    expect(recordFailedLogin).toHaveBeenCalled();
  });

  it("returns ok on valid credentials", async () => {
    const { isAccountLocked, checkLoginRateLimit, clearFailedLogins } =
      await import("./rate-limit");
    vi.mocked(isAccountLocked).mockReturnValue({ locked: false, retryAfter: 0 });
    vi.mocked(checkLoginRateLimit).mockReturnValue({ ok: true });
    vi.mocked(clearFailedLogins).mockReturnValue(undefined);

    mockExecute
      .mockResolvedValueOnce({
        rows: [makeUserRow({ password_hash: makeScryptHash("password123") })],
      })
      .mockResolvedValueOnce({ rows: [], rowsAffected: 0 })
      .mockResolvedValueOnce({ rows: [], rowsAffected: 0 });

    const { loginWithEmailHandler } = await import("./auth");
    const result = await loginWithEmailHandler({
      email: "test@example.com",
      password: "password123",
    });
    expect(result).toEqual({ ok: true, role: "owner", home: "/dashboard" });
    expect(clearFailedLogins).toHaveBeenCalled();
  });
});

describe("registerTenantHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates tenant and returns ok", async () => {
    mockBatch.mockResolvedValue(undefined);
    mockExecute.mockResolvedValue({ rows: [] });

    const { registerTenantHandler } = await import("./auth");
    const result = await registerTenantHandler({
      storeName: "Toko Baru",
      ownerName: "Owner",
      email: "new@example.com",
      password: "password123",
      plan: "warung",
    });
    expect(result).toEqual({ ok: true });
    expect(mockBatch).toHaveBeenCalled();
  });

  it("returns error on duplicate email", async () => {
    mockBatch.mockRejectedValue(new Error("UNIQUE constraint failed"));

    const { registerTenantHandler } = await import("./auth");
    const result = await registerTenantHandler({
      storeName: "Toko Baru",
      ownerName: "Owner",
      email: "existing@example.com",
      password: "password123",
      plan: "warung",
    });
    expect(result).toEqual({ ok: false, message: "Email sudah terdaftar." });
  });
});

describe("resetPasswordHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error on invalid token", async () => {
    mockExecute.mockResolvedValue({ rows: [] });

    const { resetPasswordHandler } = await import("./auth");
    const result = await resetPasswordHandler({
      token: "invalid-token",
      newPassword: "newpass123",
    });
    expect(result).toEqual({ ok: false, message: "Token tidak valid." });
  });

  it("returns error on expired token", async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    mockExecute.mockResolvedValue({
      rows: [{ id: "reset-1", user_id: "usr-1", expires_at: pastDate }],
    });

    const { resetPasswordHandler } = await import("./auth");
    const result = await resetPasswordHandler({
      token: "expired-token",
      newPassword: "newpass123",
    });
    expect(result).toEqual({ ok: false, message: "Token sudah kedaluwarsa." });
  });

  it("updates password on valid token", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockExecute
      .mockResolvedValueOnce({
        rows: [{ id: "reset-1", user_id: "usr-1", expires_at: futureDate }],
      })
      .mockResolvedValueOnce({ rows: [], rowsAffected: 1 })
      .mockResolvedValueOnce({ rows: [], rowsAffected: 1 })
      .mockResolvedValueOnce({ rows: [], rowsAffected: 2 });

    const { resetPasswordHandler } = await import("./auth");
    const result = await resetPasswordHandler({ token: "valid-token", newPassword: "newpass123" });
    expect(result).toEqual({ ok: true });
    expect(mockExecute).toHaveBeenCalledTimes(4);
  });
});
