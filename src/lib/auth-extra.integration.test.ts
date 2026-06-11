import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db/turso.server", () => ({ getTursoClient: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({
  getIp: vi.fn().mockReturnValue("127.0.0.1"),
  getCookie: vi.fn().mockReturnValue(null),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));
vi.mock("@tanstack/start-server-core", () => ({
  createServerFn: vi.fn(() => ({
    validator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockReturnThis(),
  })),
  getRequestIP: vi.fn().mockReturnValue("127.0.0.1"),
}));
vi.mock("./rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ ok: true, remaining: 9 }),
  checkLoginRateLimit: vi.fn().mockReturnValue({ ok: true, remaining: 9 }),
  isAccountLocked: vi.fn().mockResolvedValue(false),
  recordFailedLogin: vi.fn(),
  clearFailedLogins: vi.fn(),
}));
vi.mock("./csrf", () => ({
  validateCsrf: vi.fn().mockResolvedValue(true),
  generateCsrfToken: vi.fn().mockResolvedValue("mock-token"),
}));
vi.mock("./auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth")>();
  return {
    ...actual,
    requireAuthSession: vi.fn(),
    requireRole: vi.fn(),
  };
});

import { createMockDb, createMockSession } from "../__tests__/helpers";
import { getTursoClient } from "./db/turso.server";
import { requireAuthSession } from "./auth";
import { setUserPinHandler, requestPasswordResetHandler, logoutHandler } from "./auth";

const mockGetTursoClient = vi.mocked(getTursoClient);
const mockRequireAuthSession = vi.mocked(requireAuthSession);

let db: ReturnType<typeof createMockDb>;
let session: ReturnType<typeof createMockSession>;

beforeEach(() => {
  vi.clearAllMocks();
  db = createMockDb();
  session = createMockSession();
  mockGetTursoClient.mockReturnValue(db as never);
  mockRequireAuthSession.mockResolvedValue(session as never);
});

describe("setUserPinHandler", () => {
  it("sets PIN for target user", async () => {
    db.execute
      .mockResolvedValueOnce({
        rows: [{ id: "kasir-1", tenant_id: session.tenantId }],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      })
      .mockResolvedValueOnce({
        rows: [],
        columns: [],
        columnTypes: [],
        rowsAffected: 1,
        lastInsertRowid: undefined,
      });

    const result = await setUserPinHandler({
      data: { userId: "kasir-1", pin: "123456" },
      session: session as never,
    });

    expect(result.ok).toBe(true);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it("rejects when user not found in same tenant", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });

    const result = await setUserPinHandler({
      data: { userId: "kasir-other", pin: "123456" },
      session: session as never,
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; message: string }).message).toBe("User tidak ditemukan.");
  });

  it("rejects when role is not owner or manager", async () => {
    const kasirSession = createMockSession("kasir");
    const result = await setUserPinHandler({
      data: { userId: "kasir-1", pin: "123456" },
      session: kasirSession as never,
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; message: string }).message).toBe("Tidak punya akses.");
  });
});

describe("requestPasswordResetHandler", () => {
  it("generates reset token for existing user", async () => {
    db.execute
      .mockResolvedValueOnce({
        rows: [{ id: "user-1" }],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      })
      .mockResolvedValueOnce({
        rows: [],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      })
      .mockResolvedValueOnce({
        rows: [],
        columns: [],
        columnTypes: [],
        rowsAffected: 1,
        lastInsertRowid: undefined,
      });

    const result = await requestPasswordResetHandler({
      data: { email: "user@test.com" },
    });

    expect(result.ok).toBe(true);
    const r = result as { ok: true; token: string | null };
    expect(r.token).toBeTruthy();
    expect(typeof r.token).toBe("string");
    expect((r.token as string).length).toBe(64);
  });

  it("returns ok with null token for non-existent email", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });

    const result = await requestPasswordResetHandler({
      data: { email: "nobody@test.com" },
    });

    expect(result.ok).toBe(true);
    expect((result as { ok: true; token: string | null }).token).toBeNull();
  });

  it("respects rate limit", async () => {
    const { checkRateLimit } = await import("./rate-limit");
    vi.mocked(checkRateLimit).mockReturnValueOnce({
      ok: false,
      retryAfter: 120,
    });

    const result = await requestPasswordResetHandler({
      data: { email: "user@test.com" },
    });

    expect(result.ok).toBe(false);
    expect((result as { ok: false; message: string }).message).toContain(
      "Terlalu banyak permintaan",
    );
  });
});

describe("logoutHandler", () => {
  it("deletes session and returns ok", async () => {
    const { getCookie } = await import("@tanstack/react-start/server");
    vi.mocked(getCookie).mockReturnValue(session.sessionId);

    db.execute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 1,
      lastInsertRowid: undefined,
    });

    const result = await logoutHandler();

    expect(result.ok).toBe(true);
  });

  it("returns ok even when no session in cookie", async () => {
    const { getCookie } = await import("@tanstack/react-start/server");
    vi.mocked(getCookie).mockReturnValue(undefined);

    const result = await logoutHandler();

    expect(result.ok).toBe(true);
  });
});
