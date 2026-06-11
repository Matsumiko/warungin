import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { generateCsrfToken, CSRF_COOKIE } from "./lib/csrf";
import { logger } from "./lib/logger";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const capturedError = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  logger.error("h3 swallowed SSR error", { error: String(capturedError) });
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // SSE endpoint — intercept before TanStack routing
      const url = new URL(request.url);
      if (url.pathname === "/api/events") {
        const { handleSSE } = await import("./lib/sse-handler.server");
        return handleSSE(request);
      }

      const handler = await getServerEntry();
      const response = await normalizeCatastrophicSsrResponse(
        await handler.fetch(request, env, ctx),
      );

      // Security headers on every response
      const headers = new Headers(response.headers);
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("X-Frame-Options", "DENY");
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      headers.set("X-XSS-Protection", "0");
      headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
      if (process.env.NODE_ENV === "production") {
        headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
      }

      // CSRF double-submit cookie: set on first visit if not present
      const cookieHeader = request.headers.get("cookie") ?? "";
      if (!cookieHeader.includes(`${CSRF_COOKIE}=`)) {
        const token = await generateCsrfToken();
        const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
        headers.append(
          "Set-Cookie",
          `${CSRF_COOKIE}=${token}; Path=/; SameSite=Strict${secure}; Max-Age=86400`,
        );
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      logger.error("Unhandled server error", { error: String(error) });
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
