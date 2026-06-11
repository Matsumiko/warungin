import { describe, it, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { runMigrations } from "./migrate";
import { migrations } from "./migrations";
import { schemaStatements } from "./schema";

describe("Database Migrations", () => {
  let db: Client;

  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    // Run schema statements first (CREATE TABLE IF NOT EXISTS)
    await db.batch(schemaStatements.map((sql) => ({ sql })), "write");
  });

  it("runs all migrations without errors", async () => {
    const result = await runMigrations(db, migrations);
    expect(result.applied.length).toBeGreaterThan(0);
    expect(result.applied.length).toBe(migrations.length);
    expect(result.skipped).toBe(0);
  });

  it("is idempotent — running twice skips all migrations", async () => {
    await runMigrations(db, migrations);
    const second = await runMigrations(db, migrations);
    expect(second.applied.length).toBe(0);
    expect(second.skipped).toBe(migrations.length);
  });

  it("tracks applied migrations in _migrations table", async () => {
    await runMigrations(db, migrations);
    const result = await db.execute("SELECT name FROM _migrations ORDER BY name");
    const names = result.rows.map((r) => String(r.name));
    for (const m of migrations) {
      expect(names).toContain(m.name);
    }
  });

  it("creates all expected tables", async () => {
    await runMigrations(db, migrations);
    const tables = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const tableNames = new Set(tables.rows.map((r) => String(r.name)));

    const expected = [
      "tenants",
      "app_users",
      "sessions",
      "categories",
      "products",
      "product_variants",
      "product_stock",
      "customers",
      "suppliers",
      "outlets",
      "transactions",
      "transaction_items",
      "audit_logs",
      "notifications",
      "devices",
      "promotions",
      "expenses",
      "shift_reports",
      "purchase_orders",
      "purchase_order_items",
      "stock_transfers",
      "daily_sales",
      "payment_summaries",
      "tenant_settings",
      "password_resets",
      "_migrations",
    ];
    for (const t of expected) {
      expect(tableNames.has(t)).toBe(true);
    }
  });

  it("has tenant_id on all expected tables", async () => {
    await runMigrations(db, migrations);
    const tablesWithTenantId = [
      "categories",
      "products",
      "customers",
      "suppliers",
      "outlets",
      "transactions",
      "audit_logs",
      "notifications",
      "devices",
      "promotions",
      "expenses",
      "shift_reports",
      "purchase_orders",
      "purchase_order_items",
      "stock_transfers",
      "daily_sales",
      "payment_summaries",
      "sessions",
    ];
    for (const table of tablesWithTenantId) {
      const result = await db.execute(`PRAGMA table_info(${table})`);
      const columns = result.rows.map((r) => String(r.name));
      expect(columns).toContain("tenant_id");
    }
  });

  it("has customer_id on transactions table", async () => {
    await runMigrations(db, migrations);
    const result = await db.execute("PRAGMA table_info(transactions)");
    const columns = result.rows.map((r) => String(r.name));
    expect(columns).toContain("customer_id");
  });

  it("has session metadata columns", async () => {
    await runMigrations(db, migrations);
    const result = await db.execute("PRAGMA table_info(sessions)");
    const columns = result.rows.map((r) => String(r.name));
    expect(columns).toContain("user_agent");
    expect(columns).toContain("ip_address");
    expect(columns).toContain("last_seen_at");
  });

  it("has notification columns", async () => {
    await runMigrations(db, migrations);
    const result = await db.execute("PRAGMA table_info(notifications)");
    const columns = result.rows.map((r) => String(r.name));
    expect(columns).toContain("is_read");
    expect(columns).toContain("type");
  });

  it("each migration is idempotent individually", async () => {
    // Run all migrations first
    await runMigrations(db, migrations);

    // Re-run each migration's up() — should not throw
    for (const m of migrations) {
      await expect(m.up(db)).resolves.not.toThrow();
    }
  });
});
