import type { Client } from "@libsql/client";

export interface Migration {
  name: string;
  up: (db: Client) => Promise<void>;
}

const MIGRATIONS_TABLE = "_migrations";

async function ensureMigrationsTable(db: Client): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations(db: Client): Promise<Set<string>> {
  const result = await db.execute(`SELECT name FROM ${MIGRATIONS_TABLE}`);
  return new Set(result.rows.map((row) => String(row.name)));
}

export async function runMigrations(
  db: Client,
  migrations: Migration[],
): Promise<{ applied: string[]; skipped: number }> {
  await ensureMigrationsTable(db);
  const applied = await getAppliedMigrations(db);

  const pending = migrations.filter((m) => !applied.has(m.name));

  if (pending.length === 0) {
    return { applied: [], skipped: migrations.length };
  }

  const appliedNames: string[] = [];

  for (const migration of pending) {
    await migration.up(db);
    await db.execute({
      sql: `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`,
      args: [migration.name],
    });
    appliedNames.push(migration.name);
  }

  return { applied: appliedNames, skipped: migrations.length - appliedNames.length };
}
