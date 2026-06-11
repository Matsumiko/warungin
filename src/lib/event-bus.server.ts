import { logger } from "./logger";

export interface RealtimeEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

type EventListener = (event: RealtimeEvent) => void;

const listeners = new Map<string, Set<EventListener>>();

export function subscribe(tenantId: string, listener: EventListener): void {
  let set = listeners.get(tenantId);
  if (!set) {
    set = new Set();
    listeners.set(tenantId, set);
  }
  set.add(listener);
  logger.debug(`[event-bus] subscriber added for tenant ${tenantId} (${set.size} total)`);
}

export function unsubscribe(tenantId: string, listener: EventListener): void {
  const set = listeners.get(tenantId);
  if (!set) return;
  set.delete(listener);
  if (set.size === 0) {
    listeners.delete(tenantId);
  }
  logger.debug(`[event-bus] subscriber removed for tenant ${tenantId} (${set.size} remaining)`);
}

export function emit(tenantId: string, event: RealtimeEvent): void {
  const set = listeners.get(tenantId);
  if (!set || set.size === 0) return;
  for (const listener of set) {
    try {
      listener(event);
    } catch (err) {
      logger.error("[event-bus] listener error", { error: String(err), eventType: event.type });
    }
  }
}

export function getSubscriberCount(tenantId: string): number {
  return listeners.get(tenantId)?.size ?? 0;
}
