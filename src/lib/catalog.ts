import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Category, Product, ProductVariant } from "./catalog.types";
import type { RealtimeEvent } from "./event-bus.server";

async function emitEvent(tenantId: string, event: RealtimeEvent): Promise<void> {
  const { emit } = await import("./event-bus.server");
  emit(tenantId, event);
}

type DbCategory = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

type DbProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category_id: string;
  price: number;
  cost: number;
  stock: number;
  min_stock: number;
  unit: string;
  active: number;
  image: string | null;
};

type DbProductVariant = {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price_delta: number;
  stock: number;
  active: number;
};

function mapCategory(row: DbCategory): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
  };
}

function mapProduct(row: DbProduct): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    categoryId: row.category_id,
    price: Number(row.price),
    cost: Number(row.cost),
    stock: Number(row.stock),
    minStock: Number(row.min_stock),
    unit: row.unit,
    active: row.active === 1,
    image: row.image ?? undefined,
  };
}

function mapVariant(row: DbProductVariant): ProductVariant {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    sku: row.sku,
    priceDelta: Number(row.price_delta),
    stock: Number(row.stock),
    active: row.active === 1,
  };
}

async function id(prefix: string) {
  const { randomBytes } = await import("node:crypto");
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

const variantInput = z.object({
  name: z.string().trim().min(1).max(80),
  sku: z.string().trim().max(80).default(""),
  priceDelta: z.number().int().min(-1_000_000_000).max(1_000_000_000).default(0),
  stock: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

const productInput = z.object({
  name: z.string().trim().min(2).max(160),
  sku: z.string().trim().min(1).max(80),
  barcode: z.string().trim().max(80).default(""),
  categoryId: z.string().trim().min(1).max(120),
  price: z.number().int().min(0),
  cost: z.number().int().min(0).default(0),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  unit: z.string().trim().min(1).max(24),
  active: z.boolean().default(true),
  variants: z.array(variantInput).max(50).default([]),
});

export async function getCatalogHandler({ outletId }: { outletId?: string } = {}) {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const db = getTursoClient();
  const [categoryResult, productResult] = await Promise.all([
    db.execute({
      sql: `
      SELECT id, name, icon, color
      FROM categories
      WHERE tenant_id = ?
      ORDER BY sort_order ASC, name ASC
    `,
      args: [session.tenantId],
    }),
    db.execute({
      sql: `
      SELECT id, name, sku, barcode, category_id, price, cost, stock, min_stock, unit, active, image
      FROM products
      WHERE tenant_id = ?
      ORDER BY name ASC
    `,
      args: [session.tenantId],
    }),
  ]);

  const products = productResult.rows.map((row) => mapProduct(row as unknown as DbProduct));

  // Overlay per-outlet stock if outletId provided
  if (outletId) {
    const stockResult = await db.execute({
      sql: "SELECT product_id, stock FROM product_stock WHERE tenant_id = ? AND outlet_id = ?",
      args: [session.tenantId, outletId],
    });
    const stockMap = new Map<string, number>(
      stockResult.rows.map((row) => [String(row.product_id), Number(row.stock)]),
    );
    for (const product of products) {
      if (stockMap.has(product.id)) {
        product.stock = stockMap.get(product.id)!;
      } else {
        product.stock = 0;
      }
    }
  }

  return {
    categories: categoryResult.rows.map((row) => mapCategory(row as unknown as DbCategory)),
    products,
  };
}

export const getCatalog = createServerFn({ method: "GET" })
  .validator((outletId: string | undefined) => outletId ?? "")
  .handler(async ({ data }) => getCatalogHandler({ outletId: data || undefined }));

export async function createCategoryHandler({
  data,
}: {
  data: { name: string; icon: string; color: string };
}) {
  const { requireRole } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireRole(["owner", "manager", "gudang"]);
  const categoryId = await id("cat");

  await getTursoClient().execute({
    sql: `
      INSERT INTO categories (id, tenant_id, name, icon, color)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [
      categoryId,
      session.tenantId,
      data.name.trim(),
      data.icon.trim() || "🏷️",
      data.color.trim() || "var(--color-primary)",
    ],
  });

  return { ok: true as const, id: categoryId };
}

export const createCategory = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(2).max(80),
      icon: z.string().trim().max(8).default("🏷️"),
      color: z.string().trim().max(40).default("var(--color-primary)"),
    }),
  )
  .handler(async ({ data }) => createCategoryHandler({ data }));

export async function updateCategoryHandler({
  data,
}: {
  data: { id: string; name: string; icon: string; color: string };
}) {
  const { requireRole } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireRole(["owner", "manager", "gudang"]);
  const result = await getTursoClient().execute({
    sql: `
      UPDATE categories
      SET name = ?, icon = ?, color = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `,
    args: [
      data.name.trim(),
      data.icon.trim() || "🏷️",
      data.color.trim() || "var(--color-primary)",
      data.id,
      session.tenantId,
    ],
  });
  return { ok: Number(result.rowsAffected) > 0 };
}

export const updateCategory = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(2).max(80),
      icon: z.string().trim().max(8).default("🏷️"),
      color: z.string().trim().max(40).default("var(--color-primary)"),
    }),
  )
  .handler(async ({ data }) => updateCategoryHandler({ data }));

export async function deleteCategoryHandler({ data }: { data: { id: string } }) {
  const { requireRole } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireRole(["owner", "manager", "gudang"]);
  const db = getTursoClient();
  const products = await db.execute({
    sql: "SELECT COUNT(*) AS count FROM products WHERE category_id = ? AND tenant_id = ?",
    args: [data.id, session.tenantId],
  });
  if (Number(products.rows[0]?.count ?? 0) > 0) {
    return { ok: false as const, message: "Kategori masih punya produk." };
  }
  await db.execute({
    sql: "DELETE FROM categories WHERE id = ? AND tenant_id = ?",
    args: [data.id, session.tenantId],
  });
  return { ok: true as const };
}

export const deleteCategory = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(1) }))
  .handler(async ({ data }) => deleteCategoryHandler({ data }));

export async function createProductHandler({ data }: { data: z.infer<typeof productInput> }) {
  const { requireRole } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireRole(["owner", "manager", "gudang"]);
  const db = getTursoClient();

  const category = await db.execute({
    sql: "SELECT id FROM categories WHERE id = ? AND tenant_id = ? LIMIT 1",
    args: [data.categoryId, session.tenantId],
  });
  if (!category.rows.length) {
    return { ok: false as const, message: "Kategori tidak ditemukan untuk toko ini." };
  }
  const sku = data.sku.trim();
  const duplicate = await db.execute({
    sql: "SELECT id FROM products WHERE tenant_id = ? AND sku = ? LIMIT 1",
    args: [session.tenantId, sku],
  });
  if (duplicate.rows.length) {
    return { ok: false as const, message: "SKU sudah dipakai di toko ini. Gunakan SKU lain." };
  }

  const productId = await id("prd");

  // Find first active outlet for per-outlet stock seeding
  const defaultOutlet = await db.execute({
    sql: "SELECT id FROM outlets WHERE tenant_id = ? AND active = 1 ORDER BY created_at ASC LIMIT 1",
    args: [session.tenantId],
  });
  const defaultOutletId = String(defaultOutlet.rows[0]?.id ?? "");

  try {
    await db.batch(
      [
        {
          sql: `
          INSERT INTO products (
            id, tenant_id, name, sku, barcode, category_id, price, cost,
            stock, min_stock, unit, active
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          args: [
            productId,
            session.tenantId,
            data.name.trim(),
            sku,
            data.barcode.trim(),
            data.categoryId,
            data.price,
            data.cost,
            data.stock,
            data.minStock,
            data.unit.trim(),
            data.active ? 1 : 0,
          ],
        },
        ...data.variants.map((variant) => ({
          sql: `
              INSERT INTO product_variants (
                id, tenant_id, product_id, name, sku, price_delta, stock, active
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
          args: [
            crypto.randomUUID(),
            session.tenantId,
            productId,
            variant.name.trim(),
            variant.sku.trim(),
            variant.priceDelta,
            variant.stock,
            variant.active ? 1 : 0,
          ],
        })),
        // Seed per-outlet stock for default outlet
        ...(defaultOutletId && data.stock > 0
          ? [
              {
                sql: `INSERT INTO product_stock (id, tenant_id, product_id, outlet_id, stock)
                      VALUES (?, ?, ?, ?, ?)`,
                args: [await id("ps"), session.tenantId, productId, defaultOutletId, data.stock],
              },
            ]
          : []),
      ],
      "write",
    );
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
      return { ok: false as const, message: "SKU sudah dipakai. Gunakan SKU lain." };
    }
    throw error;
  }

  return { ok: true as const, id: productId };
}

export const createProduct = createServerFn({ method: "POST" })
  .validator(productInput)
  .handler(async ({ data }) => createProductHandler({ data }));

export async function getProductEditorHandler({ data }: { data: string }) {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const db = getTursoClient();
  const [categoryResult, productResult, variantResult] = await Promise.all([
    db.execute({
      sql: `
        SELECT id, name, icon, color
        FROM categories
        WHERE tenant_id = ?
        ORDER BY sort_order ASC, name ASC
      `,
      args: [session.tenantId],
    }),
    db.execute({
      sql: `
        SELECT id, name, sku, barcode, category_id, price, cost, stock, min_stock, unit, active, image
        FROM products
        WHERE id = ? AND tenant_id = ?
        LIMIT 1
      `,
      args: [data, session.tenantId],
    }),
    db.execute({
      sql: `
        SELECT id, product_id, name, sku, price_delta, stock, active
        FROM product_variants
        WHERE product_id = ? AND tenant_id = ?
        ORDER BY created_at ASC
      `,
      args: [data, session.tenantId],
    }),
  ]);
  const product = productResult.rows[0] as unknown as DbProduct | undefined;
  return {
    categories: categoryResult.rows.map((row) => mapCategory(row as unknown as DbCategory)),
    product: product ? mapProduct(product) : null,
    variants: variantResult.rows.map((row) => mapVariant(row as unknown as DbProductVariant)),
  };
}

export const getProductEditor = createServerFn({ method: "GET" })
  .validator((productId: string) => productId)
  .handler(async ({ data }) => getProductEditorHandler({ data }));

export async function updateProductHandler({
  data,
}: {
  data: z.infer<typeof productInput> & { id: string };
}) {
  const { requireRole } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireRole(["owner", "manager", "gudang"]);
  const db = getTursoClient();
  const category = await db.execute({
    sql: "SELECT id FROM categories WHERE id = ? AND tenant_id = ? LIMIT 1",
    args: [data.categoryId, session.tenantId],
  });
  if (!category.rows.length) {
    return { ok: false as const, message: "Kategori tidak ditemukan untuk toko ini." };
  }
  const sku = data.sku.trim();
  const duplicate = await db.execute({
    sql: "SELECT id FROM products WHERE tenant_id = ? AND sku = ? AND id <> ? LIMIT 1",
    args: [session.tenantId, sku, data.id],
  });
  if (duplicate.rows.length) {
    return { ok: false as const, message: "SKU sudah dipakai di toko ini. Gunakan SKU lain." };
  }

  try {
    await db.batch(
      [
        {
          sql: `
              UPDATE products
              SET name = ?, sku = ?, barcode = ?, category_id = ?, price = ?,
                  cost = ?, stock = ?, min_stock = ?, unit = ?, active = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND tenant_id = ?
            `,
          args: [
            data.name.trim(),
            sku,
            data.barcode.trim(),
            data.categoryId,
            data.price,
            data.cost,
            data.stock,
            data.minStock,
            data.unit.trim(),
            data.active ? 1 : 0,
            data.id,
            session.tenantId,
          ],
        },
        {
          sql: "DELETE FROM product_variants WHERE product_id = ? AND tenant_id = ?",
          args: [data.id, session.tenantId],
        },
        ...data.variants.map((variant) => ({
          sql: `
              INSERT INTO product_variants (
                id, tenant_id, product_id, name, sku, price_delta, stock, active
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
          args: [
            crypto.randomUUID(),
            session.tenantId,
            data.id,
            variant.name.trim(),
            variant.sku.trim(),
            variant.priceDelta,
            variant.stock,
            variant.active ? 1 : 0,
          ],
        })),
      ],
      "write",
    );
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
      return { ok: false as const, message: "SKU sudah dipakai. Gunakan SKU lain." };
    }
    throw error;
  }

  // Sync stock to product_stock for the first active outlet
  // This maintains the invariant: products.stock = SUM(product_stock.stock)
  const { setOutletStock } = await import("./product-stock.server");
  const defaultOutlet = await db.execute({
    sql: "SELECT id FROM outlets WHERE tenant_id = ? AND active = 1 ORDER BY created_at ASC LIMIT 1",
    args: [session.tenantId],
  });
  const defaultOutletId = String(defaultOutlet.rows[0]?.id ?? "");
  if (defaultOutletId) {
    await setOutletStock(db, session.tenantId, data.id, defaultOutletId, data.stock);
  }

  return { ok: true as const };
}

export const updateProduct = createServerFn({ method: "POST" })
  .validator(productInput.extend({ id: z.string().trim().min(1) }))
  .handler(async ({ data }) => updateProductHandler({ data }));

export async function adjustProductStockHandler({
  data,
}: {
  data: { productId: string; stock: number; note: string; outletId?: string };
}) {
  const { requireRole } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const { setOutletStock, getOutletIdByName } = await import("./product-stock.server");
  const session = await requireRole(["owner", "manager", "gudang"]);
  const db = getTursoClient();
  const productResult = await db.execute({
    sql: "SELECT id, name, stock, min_stock, unit FROM products WHERE id = ? AND tenant_id = ? LIMIT 1",
    args: [data.productId, session.tenantId],
  });
  const product = productResult.rows[0] as unknown as
    | { id: string; name: string; stock: number; min_stock: number; unit: string }
    | undefined;
  if (!product) {
    return { ok: false as const, message: "Produk tidak ditemukan." };
  }

  // Resolve outlet: use provided outletId, or first active outlet
  let outletId = data.outletId ?? "";
  if (!outletId) {
    const outlets = await db.execute({
      sql: "SELECT id FROM outlets WHERE tenant_id = ? AND active = 1 ORDER BY created_at ASC LIMIT 1",
      args: [session.tenantId],
    });
    outletId = String(outlets.rows[0]?.id ?? "");
  }
  if (!outletId) {
    return { ok: false as const, message: "Tidak ada outlet aktif." };
  }

  const oldStock = await getOutletStockFromDb(db, session.tenantId, data.productId, outletId);
  await setOutletStock(db, session.tenantId, data.productId, outletId, data.stock);

  // Resolve outlet name for audit log
  const outletResult = await db.execute({
    sql: "SELECT name FROM outlets WHERE id = ? AND tenant_id = ? LIMIT 1",
    args: [outletId, session.tenantId],
  });
  const outletName = String(outletResult.rows[0]?.name ?? "Unknown");

  await db.execute({
    sql: `INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
          VALUES (?, ?, ?, 'stock.adjusted', ?, ?)`,
    args: [
      await id("aud"),
      session.tenantId,
      session.name,
      product.name,
      `Stok ${oldStock} → ${data.stock} · Outlet: ${outletName}${data.note ? ` · ${data.note}` : ""}`,
    ],
  });

  await emitEvent(session.tenantId, {
    type: "stock.changed",
    data: {
      productId: data.productId,
      productName: product.name,
      newStock: data.stock,
      oldStock,
    },
    timestamp: Date.now(),
  });

  // Emit low.stock + persist notification when adjusted stock is below minimum
  if (data.stock < product.min_stock) {
    await emitEvent(session.tenantId, {
      type: "low.stock",
      data: {
        productId: data.productId,
        productName: product.name,
        currentStock: data.stock,
        minStock: product.min_stock,
      },
      timestamp: Date.now(),
    });
    const { getTursoClient } = await import("./db/turso.server");
    const notifId = `notif_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    await getTursoClient().execute({
      sql: `INSERT INTO notifications (id, tenant_id, title, description, severity, type, is_read)
            VALUES (?, ?, ?, ?, 'warning', 'low_stock', 0)`,
      args: [
        notifId,
        session.tenantId,
        `Stok ${product.name} menipis`,
        `Sisa ${data.stock} ${product.unit}, minimum ${product.min_stock}`,
      ],
    });
  }

  return { ok: true as const };
}

async function getOutletStockFromDb(
  db: Awaited<ReturnType<(typeof import("./db/turso.server"))["getTursoClient"]>>,
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

export const adjustProductStock = createServerFn({ method: "POST" })
  .validator(
    z.object({
      productId: z.string().trim().min(1),
      stock: z.number().int().min(0),
      note: z.string().trim().max(240).default(""),
      outletId: z.string().trim().min(1).optional(),
    }),
  )
  .handler(async ({ data }) => adjustProductStockHandler({ data }));
