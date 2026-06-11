import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  type UserRole,
  type AuthSession,
  type SessionRow,
  type UserPasswordRow,
  normalizeRole,
  normalizeEmail,
  hasAnyRole,
  roleHomePath,
  hashPassword,
  verifyPassword,
} from "./auth-utils";
import {
  checkRateLimit,
  checkLoginRateLimit,
  isAccountLocked,
  recordFailedLogin,
  clearFailedLogins,
} from "./rate-limit";

async function id(prefix: string) {
  const { randomBytes } = await import("node:crypto");
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}

async function validateCsrf() {
  const { validateCsrf: validate } = await import("./csrf");
  return validate();
}

async function getIp() {
  const { getRequestIP } = await import("@tanstack/start-server-core");
  return getRequestIP({ xForwardedFor: true }) ?? "unknown";
}

async function getRequestMetadata(): Promise<{ ip: string; userAgent: string }> {
  try {
    const { getRequest, getRequestIP } = await import("@tanstack/start-server-core");
    const request = getRequest();
    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    const userAgent = request.headers.get("user-agent") ?? "";
    return { ip, userAgent };
  } catch {
    return { ip: "unknown", userAgent: "" };
  }
}

async function setSessionCookie(sessionId: string, expires: Date) {
  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

async function clearSessionCookie() {
  const { deleteCookie } = await import("@tanstack/react-start/server");
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

export async function readAuthSession(): Promise<AuthSession | null> {
  // Lazy periodic cleanup of expired sessions (runs at most once per hour)
  cleanupExpiredSessions().catch(() => {});

  const { getCookie } = await import("@tanstack/react-start/server");
  const sessionId = getCookie(SESSION_COOKIE);
  if (!sessionId) return null;

  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();
  const result = await db.execute({
    sql: `
      SELECT
        sessions.id,
        sessions.user_id,
        sessions.tenant_id,
        app_users.name,
        app_users.email,
        app_users.role,
        tenants.name AS tenant_name
      FROM sessions
      JOIN app_users ON app_users.id = sessions.user_id
      JOIN tenants ON tenants.id = sessions.tenant_id
      WHERE sessions.id = ?
        AND sessions.expires_at > CURRENT_TIMESTAMP
        AND app_users.active = 1
      LIMIT 1
    `,
    args: [sessionId],
  });

  const row = result.rows[0] as unknown as SessionRow | undefined;
  if (!row) return null;

  // Throttle last_seen_at update: only write if more than 5 minutes since last update
  db.execute({
    sql: `UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP
          WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < datetime('now', '-5 minutes'))`,
    args: [row.id],
  }).catch(() => {});

  return {
    sessionId: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    name: row.name,
    email: row.email,
    role: normalizeRole(row.role),
    tenantName: row.tenant_name,
  };
}

export async function requireAuthSession() {
  const session = await readAuthSession();
  if (!session) {
    throw new Error("Authentication required.");
  }
  return session;
}

export async function requireRole(roles: UserRole[]) {
  const session = await requireAuthSession();
  if (!hasAnyRole(session.role, roles)) {
    throw new Error("Akses role tidak diizinkan.");
  }
  return session;
}

async function createSession(user: { id: string; tenantId: string }) {
  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();
  const sessionId = await id("sess");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const { ip, userAgent } = await getRequestMetadata();

  await db.execute({
    sql: `
      INSERT INTO sessions (id, user_id, tenant_id, user_agent, ip_address, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `,
    args: [sessionId, user.id, user.tenantId, userAgent, ip, expires.toISOString()],
  });

  await setSessionCookie(sessionId, expires);
}

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  return readAuthSession();
});

export async function registerTenantHandler(data: {
  storeName: string;
  ownerName: string;
  email: string;
  password: string;
  plan: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();

  // Rate limit: 3 attempts per 5 minutes per IP
  const ip = await getIp();
  const limit = checkRateLimit(`register:${ip}`, 3, 5 * 60 * 1000);
  if (!limit.ok) {
    return {
      ok: false,
      message: `Terlalu banyak percobaan registrasi. Coba lagi dalam ${limit.retryAfter} detik.`,
    };
  }

  const email = normalizeEmail(data.email);
  const tenantId = await id("ten");
  const userId = await id("usr");

  try {
    await db.batch(
      [
        {
          sql: "INSERT INTO tenants (id, name, plan) VALUES (?, ?, ?)",
          args: [tenantId, data.storeName.trim(), data.plan],
        },
        {
          sql: `
            INSERT INTO app_users (id, tenant_id, name, email, password_hash, role)
            VALUES (?, ?, ?, ?, ?, 'owner')
          `,
          args: [userId, tenantId, data.ownerName.trim(), email, await hashPassword(data.password)],
        },
      ],
      "write",
    );
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
      return { ok: false, message: "Email sudah terdaftar." };
    }
    throw error;
  }

  await createSession({ id: userId, tenantId });

  return { ok: true };
}

export const registerTenant = createServerFn({ method: "POST" })
  .validator(
    z.object({
      storeName: z.string().trim().min(2).max(120),
      ownerName: z.string().trim().min(2).max(120),
      email: z.string().email().max(180),
      password: z.string().min(8).max(128),
      plan: z.enum(["warung", "toko", "bisnis"]),
    }),
  )
  .handler(async ({ data }) => {
    if (!(await validateCsrf())) {
      return { ok: false as const, message: "Permintaan tidak valid. Muat ulang halaman." };
    }
    return registerTenantHandler(data);
  });

export type LoginResult =
  | { ok: true; role: string; home: string }
  | { ok: false; message: string; home: string };

export async function loginWithEmailHandler(data: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  const ip = await getIp();
  const normalizedEmail = normalizeEmail(data.email);

  // Account lockout check
  const lock = isAccountLocked(normalizedEmail);
  if (lock.locked) {
    return {
      ok: false,
      message: `Akun terkunci karena terlalu banyak percobaan gagal. Coba lagi dalam ${lock.retryAfter} detik.`,
      home: "/login",
    };
  }

  // Dual-key rate limit (IP + email)
  const limit = checkLoginRateLimit(ip, normalizedEmail);
  if (!limit.ok) {
    return {
      ok: false,
      message: `Terlalu banyak percobaan. Coba lagi dalam ${limit.retryAfter} detik.`,
      home: "/login",
    };
  }

  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();

  const result = await db.execute({
    sql: `
      SELECT id, tenant_id, name, email, role, password_hash, pin_hash
      FROM app_users
      WHERE email = ? AND active = 1
      LIMIT 1
    `,
    args: [normalizedEmail],
  });

  const user = result.rows[0] as unknown as UserPasswordRow | undefined;
  if (!user || !(await verifyPassword(data.password, user.password_hash))) {
    recordFailedLogin(normalizedEmail);
    return { ok: false, message: "Email atau password salah.", home: "/login" };
  }

  clearFailedLogins(normalizedEmail);

  await db.execute({
    sql: "DELETE FROM sessions WHERE user_id = ? AND expires_at <= CURRENT_TIMESTAMP",
    args: [user.id],
  });
  await createSession({ id: user.id, tenantId: user.tenant_id });

  return { ok: true, role: normalizeRole(user.role), home: roleHomePath(user.role) };
}

export const loginWithEmail = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().email().max(180),
      password: z.string().min(1).max(128),
    }),
  )
  .handler(async ({ data }) => {
    if (!(await validateCsrf())) {
      return {
        ok: false as const,
        message: "Permintaan tidak valid. Muat ulang halaman.",
        home: "/login",
      };
    }
    return loginWithEmailHandler(data);
  });

export async function logoutHandler(): Promise<{ ok: boolean }> {
  if (!(await validateCsrf())) {
    return { ok: false };
  }

  const { getCookie } = await import("@tanstack/react-start/server");
  const sessionId = getCookie(SESSION_COOKIE);

  if (sessionId) {
    const { getTursoClient } = await import("./db/turso.server");
    await getTursoClient().execute({
      sql: "DELETE FROM sessions WHERE id = ?",
      args: [sessionId],
    });
  }

  await clearSessionCookie();
  return { ok: true };
}

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  return logoutHandler();
});

// --- PIN Login ---

export async function loginWithPinHandler(
  pin: string,
): Promise<{ ok: true; role: UserRole; home: string } | { ok: false; message: string }> {
  const ip = await getIp();
  const limit = checkRateLimit(`pin-login:${ip}`, 5, 5 * 60 * 1000);
  if (!limit.ok) {
    return {
      ok: false as const,
      message: `Terlalu banyak percobaan. Coba lagi dalam ${limit.retryAfter} detik.`,
    };
  }

  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();

  // Find all active kasir users with a PIN set
  const result = await db.execute({
    sql: `
      SELECT id, tenant_id, name, email, role, password_hash, pin_hash
      FROM app_users
      WHERE role = 'kasir' AND active = 1 AND pin_hash != ''
    `,
    args: [],
  });

  const users = result.rows as unknown as UserPasswordRow[];

  // Try each kasir user's PIN hash
  for (const user of users) {
    const pinMatch = await verifyPassword(pin, user.pin_hash);
    if (pinMatch) {
      await db.execute({
        sql: "DELETE FROM sessions WHERE user_id = ? AND expires_at <= CURRENT_TIMESTAMP",
        args: [user.id],
      });
      await createSession({ id: user.id, tenantId: user.tenant_id });
      return { ok: true as const, role: "kasir" as UserRole, home: roleHomePath("kasir") };
    }
  }

  return { ok: false as const, message: "PIN salah." };
}

export const loginWithPin = createServerFn({ method: "POST" })
  .validator(
    z.object({
      pin: z.string().regex(/^\d{6}$/, "PIN harus 6 digit angka"),
    }),
  )
  .handler(async ({ data }) => {
    if (!(await validateCsrf())) {
      return { ok: false as const, message: "Permintaan tidak valid. Muat ulang halaman." };
    }
    return loginWithPinHandler(data.pin);
  });

// --- PIN Management ---

export async function setUserPinHandler({
  data,
  session,
}: {
  data: { userId: string; pin: string };
  session: AuthSession;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (session.role !== "owner" && session.role !== "manager") {
    return { ok: false as const, message: "Tidak punya akses." };
  }

  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();

  // Verify the target user belongs to the same tenant
  const userResult = await db.execute({
    sql: "SELECT id, tenant_id FROM app_users WHERE id = ? AND tenant_id = ?",
    args: [data.userId, session.tenantId],
  });
  if (userResult.rows.length === 0) {
    return { ok: false as const, message: "User tidak ditemukan." };
  }

  const pinHash = await hashPassword(data.pin);
  await db.execute({
    sql: "UPDATE app_users SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [pinHash, data.userId],
  });

  return { ok: true as const };
}

export const setUserPin = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().min(1),
      pin: z.string().regex(/^\d{6}$/, "PIN harus 6 digit angka"),
    }),
  )
  .handler(async ({ data }) => {
    if (!(await validateCsrf())) {
      return { ok: false as const, message: "Permintaan tidak valid. Muat ulang halaman." };
    }
    const session = await requireAuthSession();
    return setUserPinHandler({ data, session });
  });

// --- Password Reset ---

async function sha256Hex(input: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(input).digest("hex");
}

export async function requestPasswordResetHandler({
  data,
}: {
  data: { email: string };
}): Promise<{ ok: true; token: string | null } | { ok: false; message: string }> {
  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();

  // Rate limit: 3 per 5 minutes per IP
  const ip = await getIp();
  const limit = checkRateLimit(`reset:${ip}`, 3, 5 * 60 * 1000);
  if (!limit.ok) {
    return {
      ok: false as const,
      message: `Terlalu banyak permintaan. Coba lagi dalam ${limit.retryAfter} detik.`,
    };
  }

  // Always return ok to avoid leaking email existence
  const userResult = await db.execute({
    sql: "SELECT id FROM app_users WHERE email = ? AND active = 1 LIMIT 1",
    args: [normalizeEmail(data.email)],
  });

  if (userResult.rows.length === 0) {
    return { ok: true as const, token: null };
  }

  const user = userResult.rows[0] as unknown as { id: string };

  // Generate token and store hash
  const tokenBytes = new Uint8Array(32);
  // Use crypto.getRandomValues if available (Bun/Node), else fall back to random
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(tokenBytes);
  } else {
    for (let i = 0; i < 32; i++) tokenBytes[i] = Math.floor(Math.random() * 256);
  }
  const token = Array.from(tokenBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const tokenHash = await sha256Hex(token);

  const resetId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  // Delete any existing reset tokens for this user
  await db.execute({
    sql: "DELETE FROM password_resets WHERE user_id = ?",
    args: [user.id],
  });

  await db.execute({
    sql: "INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    args: [resetId, user.id, tokenHash, expiresAt],
  });

  // In production, send token via email. For now, return it.
  return { ok: true as const, token };
}

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email().max(180) }))
  .handler(async ({ data }) => {
    if (!(await validateCsrf())) {
      return { ok: false as const, message: "Permintaan tidak valid. Muat ulang halaman." };
    }
    return requestPasswordResetHandler({ data });
  });

export async function resetPasswordHandler(data: {
  token: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();

  const tokenHash = await sha256Hex(data.token);

  const resetResult = await db.execute({
    sql: "SELECT id, user_id, expires_at FROM password_resets WHERE token_hash = ? LIMIT 1",
    args: [tokenHash],
  });

  if (resetResult.rows.length === 0) {
    return { ok: false, message: "Token tidak valid." };
  }

  const reset = resetResult.rows[0] as unknown as {
    id: string;
    user_id: string;
    expires_at: string;
  };

  if (new Date(reset.expires_at) < new Date()) {
    return { ok: false, message: "Token sudah kedaluwarsa." };
  }

  // Update password
  const passwordHash = await hashPassword(data.newPassword);
  await db.execute({
    sql: "UPDATE app_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [passwordHash, reset.user_id],
  });

  // Delete the used token and all other reset tokens for this user
  await db.execute({
    sql: "DELETE FROM password_resets WHERE user_id = ?",
    args: [reset.user_id],
  });

  // Invalidate all sessions for this user (force re-login)
  await db.execute({
    sql: "DELETE FROM sessions WHERE user_id = ?",
    args: [reset.user_id],
  });

  return { ok: true };
}

export const resetPassword = createServerFn({ method: "POST" })
  .validator(
    z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }),
  )
  .handler(async ({ data }) => {
    if (!(await validateCsrf())) {
      return { ok: false as const, message: "Permintaan tidak valid. Muat ulang halaman." };
    }
    return resetPasswordHandler(data);
  });

// --- Session Cleanup ---

let lastCleanupTime = 0;
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

export async function cleanupExpiredSessions(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL) return;
  lastCleanupTime = now;

  try {
    const { getTursoClient } = await import("./db/turso.server");
    await getTursoClient().execute({
      sql: "DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP",
    });
  } catch {
    // Best effort — do not crash the app
  }
}

// --- Session Management ---

export const getUserSessions = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireAuthSession();
  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();
  const result = await db.execute({
    sql: `
      SELECT id, user_agent, ip_address, last_seen_at, created_at, expires_at
      FROM sessions
      WHERE user_id = ? AND tenant_id = ? AND expires_at > CURRENT_TIMESTAMP
      ORDER BY last_seen_at DESC, created_at DESC
    `,
    args: [session.userId, session.tenantId],
  });
  return result.rows.map((row) => ({
    id: String(row.id),
    userAgent: String(row.user_agent ?? ""),
    ipAddress: String(row.ip_address ?? ""),
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
    createdAt: String(row.created_at),
    isCurrent: String(row.id) === session.sessionId,
  }));
});

export const revokeSession = createServerFn({ method: "POST" })
  .validator(z.object({ sessionId: z.string().min(1) }))
  .handler(async ({ data }) => {
    if (!(await validateCsrf())) {
      return { ok: false as const, message: "Permintaan tidak valid." };
    }
    const session = await requireAuthSession();
    if (data.sessionId === session.sessionId) {
      return { ok: false as const, message: "Tidak bisa mencabut sesi saat ini. Gunakan logout." };
    }
    const { getTursoClient } = await import("./db/turso.server");
    const result = await getTursoClient().execute({
      sql: "DELETE FROM sessions WHERE id = ? AND user_id = ? AND tenant_id = ?",
      args: [data.sessionId, session.userId, session.tenantId],
    });
    return { ok: Number(result.rowsAffected) > 0 };
  });

export const revokeAllOtherSessions = createServerFn({ method: "POST" }).handler(async () => {
  if (!(await validateCsrf())) {
    return { ok: false as const, message: "Permintaan tidak valid." };
  }
  const session = await requireAuthSession();
  const { getTursoClient } = await import("./db/turso.server");
  const result = await getTursoClient().execute({
    sql: "DELETE FROM sessions WHERE user_id = ? AND tenant_id = ? AND id <> ?",
    args: [session.userId, session.tenantId, session.sessionId],
  });
  return { ok: true as const, revoked: Number(result.rowsAffected) };
});

// --- Health Check ---

export const healthCheck = createServerFn({ method: "GET" }).handler(async () => {
  const startTime = Date.now();
  try {
    const { getTursoClient } = await import("./db/turso.server");
    await getTursoClient().execute("SELECT 1");
    return {
      status: "ok" as const,
      db: "connected" as const,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    };
  } catch {
    return {
      status: "error" as const,
      db: "disconnected" as const,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    };
  }
});
