import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db/turso.server", () => ({ getTursoClient: vi.fn() }));
vi.mock("./event-bus.server", () => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  emit: vi.fn(),
}));
vi.mock("./logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createMockDb } from "../__tests__/helpers";
import { getTursoClient } from "./db/turso.server";
import { subscribe, unsubscribe } from "./event-bus.server";
import { handleSSE } from "./sse-handler.server";

const mockGetTursoClient = vi.mocked(getTursoClient);
const mockSubscribe = vi.mocked(subscribe);
const mockUnsubscribe = vi.mocked(unsubscribe);

let db: ReturnType<typeof createMockDb>;

function createRequest(sessionCookie?: string): Request {
  const headers: Record<string, string> = {};
  if (sessionCookie) {
    headers["cookie"] = `warungin_session=${sessionCookie}`;
  }
  return new Request("http://localhost:3000/api/events", { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  db = createMockDb();
  mockGetTursoClient.mockReturnValue(db as never);
});

describe("handleSSE", () => {
  it("returns 401 when no session cookie", async () => {
    const res = await handleSSE(createRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when session is expired/invalid", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });

    const res = await handleSSE(createRequest("sess-invalid"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with SSE headers on valid session", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [{ tenant_id: "t1", user_id: "u1", name: "Test User" }],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });

    const res = await handleSSE(createRequest("sess-valid"));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
  });

  it("subscribes to event bus with correct tenantId", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [{ tenant_id: "t1", user_id: "u1", name: "Test User" }],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });

    const res = await handleSSE(createRequest("sess-valid"));
    // Read the body to trigger the stream start
    const reader = res.body!.getReader();
    await reader.read();

    expect(mockSubscribe).toHaveBeenCalledWith("t1", expect.any(Function));
  });

  it("sends retry directive in initial data", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [{ tenant_id: "t1", user_id: "u1", name: "Test User" }],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });

    const res = await handleSSE(createRequest("sess-valid"));
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const { value } = await reader.read();
    const text = decoder.decode(value);

    expect(text).toContain("retry: 5000");
  });

  it("sends heartbeat after 30 seconds", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [{ tenant_id: "t1", user_id: "u1", name: "Test User" }],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });

    const res = await handleSSE(createRequest("sess-valid"));
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    // Read initial data (retry directive)
    await reader.read();

    // Advance time past heartbeat interval
    vi.advanceTimersByTime(31_000);

    // Read heartbeat
    const { value } = await reader.read();
    const text = decoder.decode(value);

    expect(text).toContain(": heartbeat");
  });

  it("unsubscribes from event bus when stream is cancelled", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [{ tenant_id: "t1", user_id: "u1", name: "Test User" }],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });

    const res = await handleSSE(createRequest("sess-valid"));
    const reader = res.body!.getReader();
    await reader.read(); // trigger stream start

    // Cancel the stream
    await reader.cancel();

    expect(mockUnsubscribe).toHaveBeenCalledWith("t1", expect.any(Function));
  });
});
