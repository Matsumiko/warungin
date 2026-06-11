import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db/turso.server", () => ({ getTursoClient: vi.fn() }));
vi.mock("@tanstack/start-server-core", () => ({
  createServerFn: vi.fn(() => ({
    validator: vi.fn().mockReturnThis(),
    handler: vi.fn().mockReturnThis(),
  })),
}));
vi.mock("./rate-limit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("./csrf", () => ({ validateCsrfToken: vi.fn().mockResolvedValue(true) }));
vi.mock("./auth", () => ({
  requireAuthSession: vi.fn(),
  requireRole: vi.fn(),
}));

import { createMockDb, createMockSession } from "../__tests__/helpers";
import { getTursoClient } from "./db/turso.server";
import { requireAuthSession, requireRole } from "./auth";
import {
  getCatalogHandler,
  createCategoryHandler,
  updateCategoryHandler,
  deleteCategoryHandler,
  createProductHandler,
  getProductEditorHandler,
  updateProductHandler,
  adjustProductStockHandler,
} from "./catalog";

const mockGetTursoClient = vi.mocked(getTursoClient);
const mockRequireAuthSession = vi.mocked(requireAuthSession);
const mockRequireRole = vi.mocked(requireRole);

let db: ReturnType<typeof createMockDb>;
let session: ReturnType<typeof createMockSession>;

beforeEach(() => {
  vi.clearAllMocks();
  db = createMockDb();
  session = createMockSession();
  mockGetTursoClient.mockReturnValue(db as never);
  mockRequireAuthSession.mockResolvedValue(session as never);
  mockRequireRole.mockResolvedValue(session as never);
});

describe("getCatalogHandler", () => {
  it("returns categories and products for tenant", async () => {
    db.execute
      .mockResolvedValueOnce({
        rows: [
          {
            id: "cat-1",
            name: "Makanan",
            icon: "🍜",
            color: "red",
            sort_order: 0,
            created_at: "2025-01-01",
            updated_at: "2025-01-01",
            tenant_id: "t1",
          },
        ],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "prd-1",
            name: "Nasi Goreng",
            sku: "NASGOR",
            barcode: "",
            category_id: "cat-1",
            price: 15000,
            cost: 8000,
            stock: 10,
            min_stock: 5,
            unit: "pcs",
            active: 1,
            image: null,
            created_at: "2025-01-01",
            updated_at: "2025-01-01",
            tenant_id: "t1",
          },
        ],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });

    const result = await getCatalogHandler();

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe("Makanan");
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe("Nasi Goreng");
    expect(result.products[0].price).toBe(15000);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });
});

describe("createCategoryHandler", () => {
  it("creates category and returns id", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 1,
      lastInsertRowid: undefined,
    });

    const result = await createCategoryHandler({
      data: { name: "Minuman", icon: "☕", color: "blue" },
    });

    expect(result.ok).toBe(true);
    expect(result.id).toBeTruthy();
    expect(db.execute).toHaveBeenCalledOnce();
  });
});

describe("updateCategoryHandler", () => {
  it("returns ok true when category updated", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 1,
      lastInsertRowid: undefined,
    });

    const result = await updateCategoryHandler({
      data: { id: "cat-1", name: "Updated", icon: "🍕", color: "green" },
    });

    expect(result.ok).toBe(true);
  });

  it("returns ok false when category not found", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });

    const result = await updateCategoryHandler({
      data: { id: "cat-missing", name: "Nope", icon: "🍕", color: "green" },
    });

    expect(result.ok).toBe(false);
  });
});

describe("deleteCategoryHandler", () => {
  it("deletes category when no products exist", async () => {
    db.execute
      .mockResolvedValueOnce({
        rows: [{ count: 0 }],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      })
      .mockResolvedValueOnce({
        rows: [],
        columns: [],
        columnTypes: [],
        rowsAffected: 1,
        lastInsertRowid: undefined,
      });

    const result = await deleteCategoryHandler({ data: { id: "cat-1" } });

    expect(result.ok).toBe(true);
    expect(db.execute).toHaveBeenCalledTimes(2);
  });

  it("rejects deletion when products exist", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [{ count: 3 }],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });

    const result = await deleteCategoryHandler({ data: { id: "cat-1" } });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Kategori masih punya produk.");
    expect(db.execute).toHaveBeenCalledOnce();
  });
});

describe("createProductHandler", () => {
  const validProduct = {
    name: "Nasi Goreng",
    sku: "NASGOR",
    barcode: "",
    categoryId: "cat-1",
    price: 15000,
    cost: 8000,
    stock: 10,
    minStock: 5,
    unit: "pcs",
    active: true,
    variants: [],
  };

  it("creates product successfully", async () => {
    db.execute
      .mockResolvedValueOnce({
        rows: [{ id: "cat-1" }],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      })
      .mockResolvedValueOnce({
        rows: [],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });
    db.batch.mockResolvedValueOnce({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 1,
      lastInsertRowid: undefined,
    });

    const result = await createProductHandler({ data: validProduct });

    expect(result.ok).toBe(true);
    expect(result.id).toBeTruthy();
  });

  it("rejects when category not found", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });

    const result = await createProductHandler({ data: validProduct });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Kategori tidak ditemukan untuk toko ini.");
  });

  it("rejects when SKU duplicate", async () => {
    db.execute
      .mockResolvedValueOnce({
        rows: [{ id: "cat-1" }],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      })
      .mockResolvedValueOnce({
        rows: [{ id: "prd-existing" }],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });

    const result = await createProductHandler({ data: validProduct });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("SKU sudah dipakai di toko ini. Gunakan SKU lain.");
  });
});

describe("getProductEditorHandler", () => {
  it("returns product, categories, and variants", async () => {
    db.execute
      .mockResolvedValueOnce({
        rows: [
          {
            id: "cat-1",
            name: "Makanan",
            icon: "🍜",
            color: "red",
            sort_order: 0,
            created_at: "",
            updated_at: "",
            tenant_id: "t1",
          },
        ],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "prd-1",
            name: "Nasi Goreng",
            sku: "NASGOR",
            barcode: "",
            category_id: "cat-1",
            price: 15000,
            cost: 8000,
            stock: 10,
            min_stock: 5,
            unit: "pcs",
            active: 1,
            image: null,
            created_at: "",
            updated_at: "",
            tenant_id: "t1",
          },
        ],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "var-1",
            product_id: "prd-1",
            name: "Pedas",
            sku: "NASGOR-P",
            price_delta: 2000,
            stock: 5,
            active: 1,
            created_at: "",
            updated_at: "",
            tenant_id: "t1",
          },
        ],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });

    const result = await getProductEditorHandler({ data: "prd-1" });

    expect(result.categories).toHaveLength(1);
    expect(result.product).toBeTruthy();
    expect(result.product?.name).toBe("Nasi Goreng");
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].name).toBe("Pedas");
  });

  it("returns null product when not found", async () => {
    db.execute
      .mockResolvedValueOnce({
        rows: [],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      })
      .mockResolvedValueOnce({
        rows: [],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      })
      .mockResolvedValueOnce({
        rows: [],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });

    const result = await getProductEditorHandler({ data: "prd-missing" });

    expect(result.product).toBeNull();
  });
});

describe("updateProductHandler", () => {
  const updateData = {
    id: "prd-1",
    name: "Nasi Goreng Updated",
    sku: "NASGOR2",
    barcode: "",
    categoryId: "cat-1",
    price: 18000,
    cost: 9000,
    stock: 15,
    minStock: 3,
    unit: "pcs",
    active: true,
    variants: [{ name: "Extra Pedas", sku: "NASGOR-EP", priceDelta: 3000, stock: 5, active: true }],
  };

  it("updates product successfully", async () => {
    db.execute
      .mockResolvedValueOnce({
        rows: [{ id: "cat-1" }],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      })
      .mockResolvedValueOnce({
        rows: [],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });
    db.batch.mockResolvedValueOnce({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 3,
      lastInsertRowid: undefined,
    });

    const result = await updateProductHandler({ data: updateData });

    expect(result.ok).toBe(true);
  });

  it("rejects when category not found", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });

    const result = await updateProductHandler({ data: updateData });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Kategori tidak ditemukan untuk toko ini.");
  });

  it("rejects when SKU duplicate", async () => {
    db.execute
      .mockResolvedValueOnce({
        rows: [{ id: "cat-1" }],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      })
      .mockResolvedValueOnce({
        rows: [{ id: "prd-other" }],
        columns: [],
        columnTypes: [],
        rowsAffected: 0,
        lastInsertRowid: undefined,
      });

    const result = await updateProductHandler({ data: updateData });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("SKU sudah dipakai di toko ini. Gunakan SKU lain.");
  });
});

describe("adjustProductStockHandler", () => {
  it("adjusts stock and logs audit", async () => {
    // 1. Product query
    db.execute.mockResolvedValueOnce({
      rows: [{ id: "prd-1", name: "Nasi Goreng", stock: 10 }],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });
    // 2. Outlets query (find default outlet)
    db.execute.mockResolvedValueOnce({
      rows: [{ id: "out-1" }],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });
    // 3. Current stock query
    db.execute.mockResolvedValueOnce({
      rows: [{ stock: 10 }],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });
    // 4. setOutletStock batch
    db.batch.mockResolvedValueOnce({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 2,
      lastInsertRowid: undefined,
    });
    // 5. Audit log insert
    db.execute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 1,
      lastInsertRowid: undefined,
    });

    const result = await adjustProductStockHandler({
      data: { productId: "prd-1", stock: 25, note: "Stok opname" },
    });

    expect(result.ok).toBe(true);
    expect(db.batch).toHaveBeenCalledOnce();
  });

  it("rejects when product not found", async () => {
    db.execute.mockResolvedValueOnce({
      rows: [],
      columns: [],
      columnTypes: [],
      rowsAffected: 0,
      lastInsertRowid: undefined,
    });

    const result = await adjustProductStockHandler({
      data: { productId: "prd-missing", stock: 0, note: "" },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Produk tidak ditemukan.");
  });
});
