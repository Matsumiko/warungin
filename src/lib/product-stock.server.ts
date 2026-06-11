import type { Client } from "@libsql/client";

async function id(prefix: string) {
  const { randomBytes } = await import("node:crypto");
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

/**
 * Get stock for a specific (product, outlet) pair.
 * Returns 0 if no row exists yet.
 */
export async function getOutletStock(
  db: Client,
  tenantId: string,
  productId: string,
  outletId: string,
): Promise<number> {
  const result = await db.execute({
    sql: "SELECT stock FROM product_stock WHERE tenant_id = ? AND product_id = ? AND outlet_id = ? LIMIT 1",
    args: [tenantId, productId, outletId],
  });
  return Number(result.rows[0]?.stock ?? 0);
}

/**
 * Get stock for all outlets for a given product.
 */
export async function getProductStockByOutlet(
  db: Client,
  tenantId: string,
  productId: string,
): Promise<Array<{ outletId: string; stock: number }>> {
  const result = await db.execute({
    sql: "SELECT outlet_id, stock FROM product_stock WHERE tenant_id = ? AND product_id = ?",
    args: [tenantId, productId],
  });
  return result.rows.map((row) => ({
    outletId: String(row.outlet_id),
    stock: Number(row.stock),
  }));
}

/**
 * Recalculate products.stock = SUM(product_stock.stock) for a product.
 */
export async function recalcGlobalStock(
  db: Client,
  tenantId: string,
  productId: string,
): Promise<void> {
  await db.execute({
    sql: `
      UPDATE products
      SET stock = COALESCE((
        SELECT SUM(ps.stock) FROM product_stock ps
        WHERE ps.tenant_id = ? AND ps.product_id = ?
      ), 0),
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `,
    args: [tenantId, productId, productId, tenantId],
  });
}

/**
 * Set absolute stock for (product, outlet). Creates row if needed.
 * Updates products.stock aggregate in the same batch.
 */
export async function setOutletStock(
  db: Client,
  tenantId: string,
  productId: string,
  outletId: string,
  stock: number,
): Promise<void> {
  await db.batch(
    [
      {
        sql: `
          INSERT INTO product_stock (id, tenant_id, product_id, outlet_id, stock)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(tenant_id, product_id, outlet_id)
          DO UPDATE SET stock = excluded.stock, updated_at = CURRENT_TIMESTAMP
        `,
        args: [await id("ps"), tenantId, productId, outletId, stock],
      },
      {
        sql: `
          UPDATE products
          SET stock = COALESCE((
            SELECT SUM(ps.stock) FROM product_stock ps
            WHERE ps.tenant_id = ? AND ps.product_id = ?
          ), 0),
          updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND tenant_id = ?
        `,
        args: [tenantId, productId, productId, tenantId],
      },
    ],
    "write",
  );
}

/**
 * Decrement stock for (product, outlet) with guard (stock >= qty).
 * Updates products.stock aggregate in the same batch.
 * Returns failure if insufficient stock.
 */
export async function decrementOutletStock(
  db: Client,
  tenantId: string,
  productId: string,
  outletId: string,
  qty: number,
): Promise<{ ok: boolean; message?: string }> {
  // Atomic decrement with guard — UPDATE ... WHERE stock >= ? is safe against races
  const result = await db.execute({
    sql: `
      UPDATE product_stock
      SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ? AND product_id = ? AND outlet_id = ? AND stock >= ?
    `,
    args: [qty, tenantId, productId, outletId, qty],
  });

  if (result.rowsAffected === 0) {
    // Row may not exist — check if it's missing or just insufficient
    const current = await getOutletStock(db, tenantId, productId, outletId);
    return {
      ok: false,
      message: `Stok tidak cukup. Tersedia: ${current}, diminta: ${qty}`,
    };
  }

  await recalcGlobalStock(db, tenantId, productId);
  return { ok: true };
}

/**
 * Increment stock for (product, outlet). Creates row if needed.
 * Updates products.stock aggregate in the same batch.
 */
export async function upsertOutletStock(
  db: Client,
  tenantId: string,
  productId: string,
  outletId: string,
  qty: number,
): Promise<void> {
  await db.batch(
    [
      {
        sql: `
          INSERT INTO product_stock (id, tenant_id, product_id, outlet_id, stock)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(tenant_id, product_id, outlet_id)
          DO UPDATE SET stock = stock + excluded.stock, updated_at = CURRENT_TIMESTAMP
        `,
        args: [await id("ps"), tenantId, productId, outletId, qty],
      },
      {
        sql: `
          UPDATE products
          SET stock = COALESCE((
            SELECT SUM(ps.stock) FROM product_stock ps
            WHERE ps.tenant_id = ? AND ps.product_id = ?
          ), 0),
          updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND tenant_id = ?
        `,
        args: [tenantId, productId, productId, tenantId],
      },
    ],
    "write",
  );
}

/**
 * Resolve outlet_id from outlet_name for a tenant.
 */
export async function getOutletIdByName(
  db: Client,
  tenantId: string,
  outletName: string,
): Promise<string | null> {
  const result = await db.execute({
    sql: "SELECT id FROM outlets WHERE tenant_id = ? AND name = ? AND active = 1 LIMIT 1",
    args: [tenantId, outletName],
  });
  return result.rows[0] ? String(result.rows[0].id) : null;
}
