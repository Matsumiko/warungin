import { vi } from "vitest";
import type { AuthSession } from "@/lib/auth-utils";

export function createMockDb() {
  const results: Record<string, unknown[]> = {};

  return {
    execute: vi.fn().mockImplementation(({ sql }: { sql: string }) => {
      for (const [pattern, rows] of Object.entries(results)) {
        if (sql.includes(pattern)) {
          return Promise.resolve({ rows, rowsAffected: rows.length });
        }
      }
      return Promise.resolve({ rows: [], rowsAffected: 0 });
    }),
    batch: vi.fn().mockImplementation((statements: unknown[]) => {
      return Promise.resolve(statements.map(() => ({ rows: [], rowsAffected: 0 })));
    }),
    __setResult(sqlPattern: string, rows: unknown[]) {
      results[sqlPattern] = rows;
    },
    __clearResults() {
      Object.keys(results).forEach((k) => delete results[k]);
    },
  };
}

export function createMockSession(role: AuthSession["role"] = "owner"): AuthSession {
  return {
    sessionId: "sess-test-001",
    tenantId: "tenant-test-001",
    tenantName: "Toko Test",
    userId: "user-test-001",
    name: "User Test",
    email: "test@example.com",
    role,
  };
}
