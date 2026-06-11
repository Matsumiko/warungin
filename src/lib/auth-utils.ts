/**
 * Pure auth utility functions — no server-only imports.
 * Safe for both client and server bundles.
 */

export const SESSION_COOKIE = "warungin_session";
export const SESSION_DAYS = 30;

export type UserRole = "owner" | "manager" | "kasir" | "gudang" | "display";

export type AuthSession = {
  sessionId: string;
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  tenantName: string;
};

export type SessionRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: UserRole;
  tenant_name: string;
};

export type UserPasswordRow = {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: UserRole;
  password_hash: string;
  pin_hash: string;
};

const roleHome: Record<UserRole, string> = {
  owner: "/dashboard",
  manager: "/dashboard",
  kasir: "/cashier",
  gudang: "/inventory",
  display: "/customer-display",
};

const appPathRoles: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: "/dashboard", roles: ["owner", "manager"] },
  { prefix: "/products", roles: ["owner", "manager", "gudang"] },
  { prefix: "/categories", roles: ["owner", "manager", "gudang"] },
  { prefix: "/inventory", roles: ["owner", "manager", "gudang"] },
  { prefix: "/suppliers", roles: ["owner", "manager", "gudang"] },
  { prefix: "/purchase-orders", roles: ["owner", "manager", "gudang"] },
  { prefix: "/customers", roles: ["owner", "manager", "kasir"] },
  { prefix: "/promotions", roles: ["owner", "manager", "kasir"] },
  { prefix: "/expenses", roles: ["owner", "manager"] },
  { prefix: "/outlets", roles: ["owner", "manager"] },
  { prefix: "/reports", roles: ["owner", "manager"] },
  { prefix: "/devices", roles: ["owner", "manager"] },
  { prefix: "/import-export", roles: ["owner", "manager", "gudang"] },
  { prefix: "/users", roles: ["owner"] },
  { prefix: "/audit-logs", roles: ["owner", "manager"] },
  { prefix: "/settings", roles: ["owner", "manager"] },
  { prefix: "/notifications", roles: ["owner", "manager", "kasir", "gudang"] },
];

const standalonePathRoles: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: "/cashier", roles: ["owner", "manager", "kasir"] },
  { prefix: "/customer-display", roles: ["owner", "manager", "kasir", "display"] },
  { prefix: "/print", roles: ["owner", "manager", "kasir"] },
];

export function roleHomePath(role: string) {
  return roleHome[normalizeRole(role)] ?? "/dashboard";
}

export function normalizeRole(role: string): UserRole {
  if (role === "manager" || role === "kasir" || role === "gudang" || role === "display") {
    return role;
  }
  return "owner";
}

function matchesPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function canAccessAppPath(role: string, pathname: string) {
  const normalized = normalizeRole(role);
  const rule = appPathRoles
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((entry) => matchesPath(pathname, entry.prefix));
  return rule
    ? rule.roles.includes(normalized)
    : normalized === "owner" || normalized === "manager";
}

export function canAccessStandalonePath(role: string, pathname: string) {
  const normalized = normalizeRole(role);
  const rule = standalonePathRoles
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((entry) => matchesPath(pathname, entry.prefix));
  return rule ? rule.roles.includes(normalized) : normalized === "owner";
}

export function hasAnyRole(role: string, roles: UserRole[]) {
  return roles.includes(normalizeRole(role));
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  const { randomBytes, scryptSync } = await import("node:crypto");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const { scryptSync, timingSafeEqual } = await import("node:crypto");
  const [scheme, salt, expected] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !expected) return false;

  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}
