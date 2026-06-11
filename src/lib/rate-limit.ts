// ─── Store Abstraction ──────────────────────────────────────────

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface LockoutEntry {
  count: number;
  unlockAt: number;
}

export interface RateLimitStore {
  getRateLimit(key: string): RateLimitEntry | undefined;
  setRateLimit(key: string, entry: RateLimitEntry): void;
  deleteRateLimit(key: string): void;
  getLockout(email: string): LockoutEntry | undefined;
  setLockout(email: string, entry: LockoutEntry): void;
  deleteLockout(email: string): void;
  cleanupRateLimits(now: number): void;
  cleanupLockouts(now: number): void;
}

// ─── Memory Store ───────────────────────────────────────────────

class MemoryStore implements RateLimitStore {
  private rateLimits = new Map<string, RateLimitEntry>();
  private lockouts = new Map<string, LockoutEntry>();

  getRateLimit(key: string) {
    return this.rateLimits.get(key);
  }

  setRateLimit(key: string, entry: RateLimitEntry) {
    this.rateLimits.set(key, entry);
  }

  deleteRateLimit(key: string) {
    this.rateLimits.delete(key);
  }

  getLockout(email: string) {
    return this.lockouts.get(email);
  }

  setLockout(email: string, entry: LockoutEntry) {
    this.lockouts.set(email, entry);
  }

  deleteLockout(email: string) {
    this.lockouts.delete(email);
  }

  cleanupRateLimits(now: number) {
    for (const [key, entry] of this.rateLimits) {
      if (now > entry.resetAt) this.rateLimits.delete(key);
    }
  }

  cleanupLockouts(now: number) {
    for (const [key, entry] of this.lockouts) {
      if (now > entry.unlockAt) this.lockouts.delete(key);
    }
  }
}

// ─── Store Singleton ────────────────────────────────────────────

let storeInstance: RateLimitStore | null = null;

function getStore(): RateLimitStore {
  if (storeInstance) return storeInstance;
  storeInstance = new MemoryStore();
  return storeInstance;
}

// Reset store (for testing)
export function resetStore() {
  storeInstance = null;
}

// ─── Rate Limiting Logic ────────────────────────────────────────

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const s = getStore();
  s.cleanupRateLimits(now);
  s.cleanupLockouts(now);
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
  const s = getStore();
  const now = Date.now();
  const entry = s.getRateLimit(key);

  if (!entry || now > entry.resetAt) {
    s.setRateLimit(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { ok: false, retryAfter };
  }

  entry.count++;
  s.setRateLimit(key, entry);
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

const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_DURATION = 15 * 60 * 1000;

export function isAccountLocked(email: string): { locked: boolean; retryAfter?: number } {
  const s = getStore();
  const entry = s.getLockout(email);
  if (!entry) return { locked: false };

  const now = Date.now();
  if (now >= entry.unlockAt) {
    s.deleteLockout(email);
    return { locked: false };
  }

  return { locked: true, retryAfter: Math.ceil((entry.unlockAt - now) / 1000) };
}

export function recordFailedLogin(email: string): void {
  const s = getStore();
  const now = Date.now();
  const entry = s.getLockout(email);

  if (!entry || now > entry.unlockAt) {
    s.setLockout(email, { count: 1, unlockAt: now + LOCKOUT_DURATION });
  } else if (entry.count >= LOCKOUT_THRESHOLD - 1) {
    s.setLockout(email, { count: entry.count + 1, unlockAt: now + LOCKOUT_DURATION });
  } else {
    entry.count++;
    s.setLockout(email, entry);
  }
}

export function clearFailedLogins(email: string): void {
  getStore().deleteLockout(email);
}
