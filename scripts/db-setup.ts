import { createClient } from "@libsql/client";

import { schemaStatements } from "../src/lib/db/schema";
import { runMigrations } from "../src/lib/db/migrate";
import { migrations } from "../src/lib/db/migrations";

const url = process.env.TURSO_DB_URL;
const authToken = process.env.TURSO_DB_TOKEN;

if (!url || !authToken) {
  throw new Error("Missing TURSO_DB_URL or TURSO_DB_TOKEN in environment.");
}

const db = createClient({ url, authToken });

try {
  // Step 1: Create tables (idempotent)
  await db.batch(
    schemaStatements.map((sql) => ({ sql })),
    "write",
  );

  // Step 2: Apply tracked migrations
  const { applied, skipped } = await runMigrations(db, migrations);

  if (applied.length > 0) {
    console.log(`Applied ${applied.length} migration(s): ${applied.join(", ")}`);
  } else {
    console.log(`All ${skipped} migration(s) already applied.`);
  }

  // Step 3: Log summary
  const productCount = await db.execute("SELECT COUNT(*) AS count FROM products");
  const categoryCount = await db.execute("SELECT COUNT(*) AS count FROM categories");
  const productsTotal = Number(productCount.rows[0]?.count ?? 0);
  const categoriesTotal = Number(categoryCount.rows[0]?.count ?? 0);

  console.log(`Turso schema ready: ${categoriesTotal} categories, ${productsTotal} products.`);
} finally {
  db.close();
}
