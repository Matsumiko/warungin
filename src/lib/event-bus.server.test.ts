import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock logger to suppress console output
vi.mock("./logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Use resetModules so each describe block gets a fresh singleton
let subscribe: typeof import("./event-bus.server").subscribe;
let unsubscribe: typeof import("./event-bus.server").unsubscribe;
let emit: typeof import("./event-bus.server").emit;
let getSubscriberCount: typeof import("./event-bus.server").getSubscriberCount;

async function importFresh() {
  vi.resetModules();
  const mod = await import("./event-bus.server");
  subscribe = mod.subscribe;
  unsubscribe = mod.unsubscribe;
  emit = mod.emit;
  getSubscriberCount = mod.getSubscriberCount;
}

beforeEach(async () => {
  await importFresh();
});

describe("event-bus", () => {
  it("subscribe adds listener; emit calls it with event", () => {
    const listener = vi.fn();
    subscribe("t1", listener);

    const event = { type: "stock.changed", data: { productId: "p1" }, timestamp: 1000 };
    emit("t1", event);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(event);
  });

  it("emit to tenant with no subscribers is a no-op", () => {
    expect(() => emit("t1", { type: "test", data: {}, timestamp: 0 })).not.toThrow();
  });

  it("multiple listeners for same tenant all receive event", () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    subscribe("t1", listener1);
    subscribe("t1", listener2);

    const event = { type: "test", data: {}, timestamp: 0 };
    emit("t1", event);

    expect(listener1).toHaveBeenCalledOnce();
    expect(listener2).toHaveBeenCalledOnce();
  });

  it("unsubscribe removes listener; subsequent emit does not call it", () => {
    const listener = vi.fn();
    subscribe("t1", listener);
    unsubscribe("t1", listener);

    emit("t1", { type: "test", data: {}, timestamp: 0 });

    expect(listener).not.toHaveBeenCalled();
  });

  it("unsubscribe for non-existent listener is a no-op", () => {
    expect(() => unsubscribe("t1", vi.fn())).not.toThrow();
  });

  it("unsubscribe removes tenant Set when empty", () => {
    const listener = vi.fn();
    subscribe("t1", listener);
    expect(getSubscriberCount("t1")).toBe(1);

    unsubscribe("t1", listener);
    expect(getSubscriberCount("t1")).toBe(0);
  });

  it("listener error does not prevent other listeners from being called", () => {
    const errorListener = vi.fn(() => {
      throw new Error("boom");
    });
    const goodListener = vi.fn();

    subscribe("t1", errorListener);
    subscribe("t1", goodListener);

    emit("t1", { type: "test", data: {}, timestamp: 0 });

    expect(errorListener).toHaveBeenCalledOnce();
    expect(goodListener).toHaveBeenCalledOnce();
  });

  it("events are isolated per tenant", () => {
    const t1Listener = vi.fn();
    const t2Listener = vi.fn();
    subscribe("t1", t1Listener);
    subscribe("t2", t2Listener);

    emit("t1", { type: "test", data: {}, timestamp: 0 });

    expect(t1Listener).toHaveBeenCalledOnce();
    expect(t2Listener).not.toHaveBeenCalled();
  });

  it("getSubscriberCount returns correct count", () => {
    expect(getSubscriberCount("t1")).toBe(0);

    subscribe("t1", vi.fn());
    expect(getSubscriberCount("t1")).toBe(1);

    subscribe("t1", vi.fn());
    expect(getSubscriberCount("t1")).toBe(2);
  });
});
