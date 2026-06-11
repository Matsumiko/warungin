import { logger } from "./logger";
import { subscribe, unsubscribe, type RealtimeEvent } from "./event-bus.server";

const SESSION_COOKIE = "warungin_session";

const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

function parseCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === name) return value;
  }
  return undefined;
}

async function validateSession(
  request: Request,
): Promise<{ tenantId: string; userId: string; name: string } | null> {
  const sessionId = parseCookie(request, SESSION_COOKIE);
  if (!sessionId) return null;

  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();
  const result = await db.execute({
    sql: `
      SELECT sessions.tenant_id, sessions.user_id, app_users.name
      FROM sessions
      JOIN app_users ON app_users.id = sessions.user_id
      WHERE sessions.id = ?
        AND sessions.expires_at > CURRENT_TIMESTAMP
        AND app_users.active = 1
      LIMIT 1
    `,
    args: [sessionId],
  });

  const row = result.rows[0] as unknown as
    | { tenant_id: string; user_id: string; name: string }
    | undefined;
  if (!row) return null;

  return { tenantId: row.tenant_id, userId: row.user_id, name: row.name };
}

function formatSSE(event: RealtimeEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\nid: ${event.timestamp}\n\n`;
}

export async function handleSSE(request: Request): Promise<Response> {
  const session = await validateSession(request);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  let heartbeatId: ReturnType<typeof setInterval>;
  let cancelled = false;
  let listenerRef: ((event: RealtimeEvent) => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Initial retry directive
      controller.enqueue(encoder.encode("retry: 5000\n\n"));

      // Heartbeat
      heartbeatId = setInterval(() => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          // stream closed
        }
      }, 30_000);

      // Event listener
      const listener = (event: RealtimeEvent) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(formatSSE(event)));
        } catch {
          // stream closed
        }
      };

      listenerRef = listener;
      subscribe(session.tenantId, listener);

      logger.info("[sse] client connected", { tenantId: session.tenantId, userId: session.userId });
    },
    cancel() {
      cancelled = true;
      clearInterval(heartbeatId);
      if (listenerRef) {
        unsubscribe(session.tenantId, listenerRef);
      }
      logger.info("[sse] client disconnected", { tenantId: session.tenantId });
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
