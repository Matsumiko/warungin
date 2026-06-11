type RateLimitEntry = { count: number; resetAt: number };

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup every 60s to prevent unbounded growth
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
  for (const [key, entry] of lockoutStore) {
    if (now > entry.unlockAt) lockoutStore.delete(key);
  }
}

/**
 * Check rate limit for a given key.
 * @param key   Unique identifier (e.g. `login:192.168.1.1`)
 * @param limit Max attempts allowed in the window
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfter?: number } {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { ok: false, retryAfter };
  }

  entry.count++;
  return { ok: true };
}

/**
 * Dual-key rate limit for login: checks both IP and email.
 * IP limit: 5 attempts per 15 minutes.
 * Email limit: 10 attempts per 15 minutes.
 */
export function checkLoginRateLimit(
  ip: string,
  email: string,
): { ok: boolean; retryAfter?: number } {
  const ipKey = `login:ip:${ip}`;
  const emailKey = `login:email:${email}`;
  const windowMs = 15 * 60 * 1000;

  const ipResult = checkRateLimit(ipKey, 5, windowMs);
  const emailResult = checkRateLimit(emailKey, 10, windowMs);

  if (!ipResult.ok) return ipResult;
  if (!emailResult.ok) return emailResult;
  return { ok: true };
}

// ─── Account Lockout ─────────────────────────────────────────────

type LockoutEntry = { count: number; unlockAt: number };
const lockoutStore = new Map<string, LockoutEntry>();

const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_DURATION = 15 * 60 * 1000;

export function isAccountLocked(email: string): { locked: boolean; retryAfter?: number } {
  const entry = lockoutStore.get(email);
  if (!entry) return { locked: false };

  const now = Date.now();
  if (now >= entry.unlockAt) {
    lockoutStore.delete(email);
    return { locked: false };
  }

  return { locked: true, retryAfter: Math.ceil((entry.unlockAt - now) / 1000) };
}

export function recordFailedLogin(email: string): void {
  const now = Date.now();
  const entry = lockoutStore.get(email);

  if (!entry || now > entry.unlockAt) {
    lockoutStore.set(email, { count: 1, unlockAt: now + LOCKOUT_DURATION });
  } else if (entry.count >= LOCKOUT_THRESHOLD - 1) {
    // Next failure after threshold: lock immediately
    lockoutStore.set(email, { count: entry.count + 1, unlockAt: now + LOCKOUT_DURATION });
  } else {
    entry.count++;
  }
}

export function clearFailedLogins(email: string): void {
  lockoutStore.delete(email);
}
