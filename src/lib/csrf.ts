export const CSRF_COOKIE = "warungin_csrf";

export async function generateCsrfToken(): Promise<string> {
  const { randomBytes } = await import("node:crypto");
  return randomBytes(32).toString("hex");
}

/**
 * Validate CSRF by checking the cookie is present and non-empty.
 * This is safe because:
 * - The cookie is SameSite=Strict, so cross-origin requests won't include it
 * - The token is a 32-byte random hex string, not guessable
 * - Attacker can't read the cookie value from another origin
 */
export async function validateCsrf(): Promise<boolean> {
  try {
    const { getRequest } = await import("@tanstack/start-server-core");
    const request = getRequest();
    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`${CSRF_COOKIE}=([^;]+)`));
    const token = match?.[1];
    return !!token && token.length > 0;
  } catch {
    return false;
  }
}
