import { createClient, type Client } from "@libsql/client";

let client: Client | undefined;

export function getTursoClient() {
  if (client) return client;

  const url = process.env.TURSO_DB_URL;
  const authToken = process.env.TURSO_DB_TOKEN;

  if (!url || !authToken) {
    throw new Error("Turso database is not configured. Set TURSO_DB_URL and TURSO_DB_TOKEN.");
  }

  client = createClient({ url, authToken });
  return client;
}
