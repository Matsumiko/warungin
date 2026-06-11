import type { Client } from "@libsql/client";
import type { Migration } from "../migrate";

async function addColumnIfMissing(db: Client, table: string, column: string, definition: string) {
  const result = await db.execute(`PRAGMA table_info(${table})`);
  const exists = result.rows.some((row) => row.name === column);
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

const tenantIdTables = [
  "categories",
  "products",
  "product_variants",
  "suppliers",
  "customers",
  "outlets",
  "expenses",
  "purchase_orders",
  "purchase_order_items",
  "stock_transfers",
  "daily_sales",
  "payment_summaries",
  "shift_reports",
  "transactions",
  "transaction_items",
  "audit_logs",
  "notifications",
  "devices",
  "promotions",
];

export const migrations: Migration[] = [
  {
    name: "001_add_tenant_id_columns",
    up: async (db) => {
      for (const table of tenantIdTables) {
        await addColumnIfMissing(
          db,
          table,
          "tenant_id",
          "tenant_id TEXT NOT NULL DEFAULT 'default'",
        );
      }
      await addColumnIfMissing(
        db,
        "app_users",
        "tenant_id",
        "tenant_id TEXT NOT NULL DEFAULT 'default'",
      );
    },
  },
  {
    name: "002_add_auth_columns",
    up: async (db) => {
      await addColumnIfMissing(
        db,
        "app_users",
        "password_hash",
        "password_hash TEXT NOT NULL DEFAULT ''",
      );
      await addColumnIfMissing(db, "app_users", "pin_hash", "pin_hash TEXT NOT NULL DEFAULT ''");
    },
  },
  {
    name: "003_add_password_resets",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES app_users(id),
          token_hash TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id)",
      );
      await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash)",
      );
    },
  },
  {
    name: "004_add_transaction_payment_method",
    up: async (db) => {
      await addColumnIfMissing(
        db,
        "transactions",
        "payment_method",
        "payment_method TEXT NOT NULL DEFAULT 'Cash'",
      );
    },
  },
  {
    name: "005_add_transaction_service_charge",
    up: async (db) => {
      await addColumnIfMissing(
        db,
        "transactions",
        "service_charge",
        "service_charge INTEGER NOT NULL DEFAULT 0",
      );
    },
  },
  {
    name: "006_add_shift_cash_columns",
    up: async (db) => {
      await addColumnIfMissing(
        db,
        "shift_reports",
        "opening_cash",
        "opening_cash INTEGER NOT NULL DEFAULT 0",
      );
      await addColumnIfMissing(
        db,
        "shift_reports",
        "closing_cash",
        "closing_cash INTEGER NOT NULL DEFAULT 0",
      );
    },
  },
  {
    name: "007_migrate_products_sku_tenant_scoped",
    up: async (db) => {
      const table = await db.execute({
        sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'products' LIMIT 1",
        args: [],
      });
      const createSql = String(table.rows[0]?.sql ?? "").toLowerCase();
      const hasGlobalSkuUnique =
        createSql.includes("sku text not null unique") || createSql.includes("unique(sku)");

      if (!hasGlobalSkuUnique) return;

      await db.execute("PRAGMA foreign_keys = OFF");
      try {
        await db.batch(
          [
            "DROP TABLE IF EXISTS products_tenant_sku_migration",
            `CREATE TABLE products_tenant_sku_migration (
              id TEXT PRIMARY KEY,
              tenant_id TEXT NOT NULL DEFAULT 'default',
              name TEXT NOT NULL,
              sku TEXT NOT NULL,
              barcode TEXT NOT NULL DEFAULT '',
              category_id TEXT NOT NULL REFERENCES categories(id),
              price INTEGER NOT NULL CHECK (price >= 0),
              cost INTEGER NOT NULL CHECK (cost >= 0),
              stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
              min_stock INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
              unit TEXT NOT NULL DEFAULT 'pcs',
              active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
              image TEXT,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )`,
            `INSERT INTO products_tenant_sku_migration (
              id, tenant_id, name, sku, barcode, category_id, price, cost,
              stock, min_stock, unit, active, image, created_at, updated_at
            )
            SELECT
              id, tenant_id, name, sku, barcode, category_id, price, cost,
              stock, min_stock, unit, active, image, created_at, updated_at
            FROM products`,
            "DROP TABLE products",
            "ALTER TABLE products_tenant_sku_migration RENAME TO products",
          ].map((sql) => ({ sql })),
          "write",
        );
      } finally {
        await db.execute("PRAGMA foreign_keys = ON");
      }
    },
  },
  {
    name: "008_add_product_stock_table",
    up: async (db) => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS product_stock (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'default',
          product_id TEXT NOT NULL REFERENCES products(id),
          outlet_id TEXT NOT NULL REFERENCES outlets(id),
          stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await db.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_product_stock_tenant_product_outlet ON product_stock(tenant_id, product_id, outlet_id)",
      );
      await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_product_stock_product ON product_stock(product_id)",
      );
      await db.execute(
        "CREATE INDEX IF NOT EXISTS idx_product_stock_outlet ON product_stock(outlet_id)",
      );

      // Backfill: assign each product's global stock to its first active outlet
      const products = await db.execute(
        "SELECT id, tenant_id, stock FROM products WHERE stock > 0",
      );
      for (const row of products.rows) {
        const productId = String(row.id);
        const tenantId = String(row.tenant_id);
        const stock = Number(row.stock);

        // Find the first active outlet for this tenant
        const outlets = await db.execute({
          sql: "SELECT id FROM outlets WHERE tenant_id = ? AND active = 1 ORDER BY created_at ASC LIMIT 1",
          args: [tenantId],
        });
        const outletId = String(outlets.rows[0]?.id ?? "");
        if (!outletId) continue;

        // Skip if already seeded
        const existing = await db.execute({
          sql: "SELECT id FROM product_stock WHERE tenant_id = ? AND product_id = ? AND outlet_id = ? LIMIT 1",
          args: [tenantId, productId, outletId],
        });
        if (existing.rows.length > 0) continue;

        await db.execute({
          sql: `INSERT INTO product_stock (id, tenant_id, product_id, outlet_id, stock)
                VALUES (?, ?, ?, ?, ?)`,
          args: [
            `ps_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
            tenantId,
            productId,
            outletId,
            stock,
          ],
        });
      }
    },
  },
  {
    name: "009_add_tenant_indexes",
    up: async (db) => {
      await db.batch(
        [
          "CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id)",
          "CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_sku ON products(tenant_id, sku)",
          "CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)",
          "CREATE INDEX IF NOT EXISTS idx_products_active ON products(active)",
          "CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)",
          "CREATE INDEX IF NOT EXISTS idx_product_variants_tenant_id ON product_variants(tenant_id)",
          "CREATE INDEX IF NOT EXISTS idx_expenses_tenant_id ON expenses(tenant_id)",
          "CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_id ON purchase_orders(tenant_id)",
          "CREATE INDEX IF NOT EXISTS idx_purchase_order_items_tenant_id ON purchase_order_items(tenant_id)",
          "CREATE INDEX IF NOT EXISTS idx_stock_transfers_tenant_id ON stock_transfers(tenant_id)",
          "CREATE INDEX IF NOT EXISTS idx_daily_sales_tenant_id ON daily_sales(tenant_id)",
          "CREATE INDEX IF NOT EXISTS idx_shift_reports_tenant_id ON shift_reports(tenant_id)",
          "CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON transactions(tenant_id)",
          "CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id)",
          "CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON notifications(tenant_id)",
          "CREATE INDEX IF NOT EXISTS idx_devices_tenant_id ON devices(tenant_id)",
          "CREATE INDEX IF NOT EXISTS idx_promotions_tenant_id ON promotions(tenant_id)",
          "CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON tenant_settings(tenant_id)",
        ].map((sql) => ({ sql })),
        "write",
      );
    },
  },
  {
    name: "010_add_notification_columns",
    up: async (db) => {
      await addColumnIfMissing(
        db,
        "notifications",
        "is_read",
        "is_read INTEGER NOT NULL DEFAULT 0",
      );
      await addColumnIfMissing(db, "notifications", "type", "type TEXT NOT NULL DEFAULT 'info'");
    },
  },
  {
    name: "011_add_session_metadata",
    up: async (db) => {
      await addColumnIfMissing(db, "sessions", "user_agent", "user_agent TEXT NOT NULL DEFAULT ''");
      await addColumnIfMissing(db, "sessions", "ip_address", "ip_address TEXT NOT NULL DEFAULT ''");
      await addColumnIfMissing(db, "sessions", "last_seen_at", "last_seen_at TEXT");
    },
  },
  {
    name: "012_add_transaction_customer_id",
    up: async (db) => {
      await addColumnIfMissing(db, "transactions", "customer_id", "customer_id TEXT");
    },
  },
];
