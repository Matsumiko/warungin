import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockDb, createMockSession } from "../__tests__/helpers";

// --- Mocks ---
vi.mock("./db/turso.server", () => ({
  getTursoClient: vi.fn(),
}));

vi.mock("@tanstack/start-server-core", () => ({
  getRequestIP: vi.fn().mockReturnValue("192.168.1.1"),
}));

vi.mock("./rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ ok: true }),
  checkLoginRateLimit: vi.fn().mockReturnValue({ ok: true }),
  isAccountLocked: vi.fn().mockReturnValue({ locked: false }),
  recordFailedLogin: vi.fn(),
  clearFailedLogins: vi.fn(),
}));

vi.mock("./csrf", () => ({
  CSRF_COOKIE: "csrf_token",
  validateCsrf: vi.fn().mockReturnValue(true),
  generateCsrfToken: vi.fn().mockResolvedValue("csrf-token-123"),
}));

vi.mock("./auth", () => ({
  requireRole: vi.fn(),
  requireAuthSession: vi.fn(),
}));

// --- Imports (after all vi.mock calls) ---
import {
  openShiftHandler,
  closeShiftHandler,
  createTransactionHandler,
  createSupplierHandler,
  updateSupplierHandler,
  deleteSupplierHandler,
  createCustomerHandler,
  updateCustomerHandler,
  deleteCustomerHandler,
  createStockTransferHandler,
  createExpenseHandler,
  createPurchaseOrderHandler,
} from "./backoffice";
import { getTursoClient } from "./db/turso.server";
import { requireRole, requireAuthSession } from "./auth";

const mockSession = createMockSession();
const db = createMockDb();

const defaultTenantSettings = {
  taxEnabled: "1",
  taxRate: "11",
  taxMode: "exclusive",
  serviceCharge: "0",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.__clearResults();
  db.execute.mockImplementation(({ sql }: { sql: string }) => {
    // Default: return empty results for any query
    return Promise.resolve({ rows: [], rowsAffected: 0 });
  });
  db.batch.mockResolvedValue(Array.from({ length: 10 }).map(() => ({ rows: [], rowsAffected: 1 })));
  vi.mocked(getTursoClient).mockReturnValue(db as never);
  vi.mocked(requireRole).mockResolvedValue(mockSession as never);
  vi.mocked(requireAuthSession).mockResolvedValue(mockSession as never);
});

// ─── openShiftHandler ───────────────────────────────────────────────────────
describe("openShiftHandler", () => {
  it("creates a new shift when no active shift exists", async () => {
    db.execute.mockImplementation(({ sql }: { sql: string }) => {
      if (sql.includes("closed_at IS NULL")) return Promise.resolve({ rows: [], rowsAffected: 0 });
      return Promise.resolve({ rows: [], rowsAffected: 1 });
    });

    const result = await openShiftHandler({
      session: mockSession,
      data: { openingCash: 500000, outletName: "Outlet Utama" },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects when an active shift already exists", async () => {
    db.execute.mockImplementation(({ sql }: { sql: string }) => {
      console.log("DEBUG SQL:", sql);
      if (sql.includes("closed_at IS NULL"))
        return Promise.resolve({ rows: [{ id: "shift-1" }], rowsAffected: 0 });
      return Promise.resolve({ rows: [], rowsAffected: 0 });
    });

    const result = await openShiftHandler({
      session: mockSession,
      data: { openingCash: 500000, outletName: "Outlet Utama" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/shift aktif/);
  });
});

// ─── closeShiftHandler ──────────────────────────────────────────────────────
describe("closeShiftHandler", () => {
  it("closes an active shift", async () => {
    db.execute.mockImplementation(({ sql }: { sql: string }) => {
      if (sql.includes("closed_at IS NULL"))
        return Promise.resolve({
          rows: [{ id: "shift-1", opened_at: "2026-06-09T08:00:00", opening_cash: 500000 }],
          rowsAffected: 0,
        });
      if (sql.includes("SUM(total)"))
        return Promise.resolve({ rows: [{ cash_sales: 750000 }], rowsAffected: 0 });
      return Promise.resolve({ rows: [], rowsAffected: 1 });
    });

    const result = await closeShiftHandler({
      session: mockSession,
      data: { shiftId: "shift-1", actualCash: 1250000 },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects when no active shift found", async () => {
    db.execute.mockImplementation(({ sql }: { sql: string }) => {
      if (sql.includes("closed_at IS NULL")) return Promise.resolve({ rows: [], rowsAffected: 0 });
      return Promise.resolve({ rows: [], rowsAffected: 0 });
    });

    const result = await closeShiftHandler({
      session: mockSession,
      data: { shiftId: "shift-2", actualCash: 500000 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/tidak ditemukan/);
  });
});

// ─── createTransactionHandler ───────────────────────────────────────────────
describe("createTransactionHandler", () => {
  it("succeeds with valid products, stock, and totals", async () => {
    db.execute.mockImplementation(({ sql }: { sql: string }) => {
      if (sql.includes("FROM products") && sql.includes("WHERE tenant_id")) {
        return Promise.resolve({
          rows: [
            { id: "prod-1", name: "Kopi", stock: 10, price: 15000 },
            { id: "prod-2", name: "Teh", stock: 20, price: 10000 },
          ],
          rowsAffected: 0,
        });
      }
      if (sql.includes("FROM tenant_settings") && sql.includes("WHERE tenant_id")) {
        return Promise.resolve({
          rows: Object.entries(defaultTenantSettings).map(([key, value]) => ({ key, value })),
          rowsAffected: 0,
        });
      }
      return Promise.resolve({ rows: [], rowsAffected: 0 });
    });

    const result = await createTransactionHandler({
      data: {
        paymentMethod: "cash",
        cashReceived: 35000,
        subtotal: 25000,
        tax: 2750,
        serviceCharge: 0,
        total: 27750,
        items: [
          { productId: "prod-1", name: "Kopi", qty: 1, price: 15000 },
          { productId: "prod-2", name: "Teh", qty: 1, price: 10000 },
        ],
      },
      session: mockSession,
    });

    expect(result.ok).toBe(true);
    expect(db.batch).toHaveBeenCalled();
  });

  it("returns error when a product is not found", async () => {
    db.execute.mockImplementation(({ sql }: { sql: string }) => {
      if (sql.includes("FROM products") && sql.includes("WHERE tenant_id")) {
        return Promise.resolve({
          rows: [{ id: "prod-1", name: "Kopi", stock: 10, price: 15000 }],
          rowsAffected: 0,
        });
      }
      if (sql.includes("FROM tenant_settings")) {
        return Promise.resolve({
          rows: Object.entries(defaultTenantSettings).map(([key, value]) => ({ key, value })),
          rowsAffected: 0,
        });
      }
      return Promise.resolve({ rows: [], rowsAffected: 0 });
    });

    const result = await createTransactionHandler({
      data: {
        paymentMethod: "cash",
        cashReceived: 25000,
        subtotal: 25000,
        tax: 2750,
        serviceCharge: 0,
        total: 27750,
        items: [
          { productId: "prod-1", name: "Kopi", qty: 1, price: 15000 },
          { productId: "prod-999", name: "Missing", qty: 1, price: 10000 },
        ],
      },
      session: mockSession,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/tidak ditemukan/);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("returns error when stock is insufficient", async () => {
    db.execute.mockImplementation(({ sql }: { sql: string }) => {
      if (sql.includes("FROM products") && sql.includes("WHERE tenant_id")) {
        return Promise.resolve({
          rows: [{ id: "prod-1", name: "Kopi", stock: 2, price: 15000 }],
          rowsAffected: 0,
        });
      }
      if (sql.includes("FROM tenant_settings")) {
        return Promise.resolve({
          rows: Object.entries(defaultTenantSettings).map(([key, value]) => ({ key, value })),
          rowsAffected: 0,
        });
      }
      return Promise.resolve({ rows: [], rowsAffected: 0 });
    });

    const result = await createTransactionHandler({
      data: {
        paymentMethod: "cash",
        cashReceived: 75000,
        subtotal: 75000,
        tax: 8250,
        serviceCharge: 0,
        total: 83250,
        items: [{ productId: "prod-1", name: "Kopi", qty: 5, price: 15000 }],
      },
      session: mockSession,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Stok/);
      expect(result.message).toMatch(/tidak cukup/);
    }
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("returns error when client totals don't match server calculation", async () => {
    db.execute.mockImplementation(({ sql }: { sql: string }) => {
      if (sql.includes("FROM products") && sql.includes("WHERE tenant_id")) {
        return Promise.resolve({
          rows: [{ id: "prod-1", name: "Kopi", stock: 10, price: 15000 }],
          rowsAffected: 0,
        });
      }
      if (sql.includes("FROM tenant_settings")) {
        return Promise.resolve({
          rows: Object.entries(defaultTenantSettings).map(([key, value]) => ({ key, value })),
          rowsAffected: 0,
        });
      }
      return Promise.resolve({ rows: [], rowsAffected: 0 });
    });

    const result = await createTransactionHandler({
      data: {
        paymentMethod: "cash",
        cashReceived: 15000,
        subtotal: 15000,
        tax: 0, // tampered: should be 1650
        serviceCharge: 0,
        total: 15000, // tampered: should be 16650
        items: [{ productId: "prod-1", name: "Kopi", qty: 1, price: 15000 }],
      },
      session: mockSession,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/Total transaksi tidak valid/);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("calculates inclusive tax correctly", async () => {
    db.execute.mockImplementation(({ sql }: { sql: string }) => {
      if (sql.includes("FROM products") && sql.includes("WHERE tenant_id")) {
        return Promise.resolve({
          rows: [{ id: "prod-1", name: "Kopi", stock: 10, price: 10000 }],
          rowsAffected: 0,
        });
      }
      if (sql.includes("FROM tenant_settings")) {
        return Promise.resolve({
          rows: [
            { key: "taxEnabled", value: "1" },
            { key: "taxRate", value: "11" },
            { key: "taxMode", value: "inclusive" },
            { key: "serviceCharge", value: "0" },
          ],
          rowsAffected: 0,
        });
      }
      return Promise.resolve({ rows: [], rowsAffected: 0 });
    });

    const result = await createTransactionHandler({
      data: {
        paymentMethod: "cash",
        cashReceived: 10000,
        subtotal: 10000,
        tax: 991, // 10000 * 11 / 111 ≈ 990.99 → 991
        serviceCharge: 0,
        total: 10000, // inclusive: total = subtotal
        items: [{ productId: "prod-1", name: "Kopi", qty: 1, price: 10000 }],
      },
      session: mockSession,
    });

    expect(result.ok).toBe(true);
    expect(db.batch).toHaveBeenCalled();
  });
});

// ─── CRUD: Suppliers ────────────────────────────────────────────────────────
describe("createSupplierHandler", () => {
  it("creates a supplier successfully", async () => {
    db.execute.mockResolvedValue({ rows: [], rowsAffected: 1 });

    const result = await createSupplierHandler({
      data: { name: "Supplier A", contact: "Budi", phone: "08123" },
      session: mockSession,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toMatch(/^sup_/);
  });
});

describe("updateSupplierHandler", () => {
  it("updates an existing supplier", async () => {
    db.execute.mockResolvedValue({ rows: [], rowsAffected: 1 });

    const result = await updateSupplierHandler({
      data: { id: "sup-1", name: "Supplier Updated", contact: "Budi", phone: "08123" },
      session: mockSession,
    });

    expect(result.ok).toBe(true);
  });

  it("returns false when supplier not found", async () => {
    db.execute.mockResolvedValue({ rows: [], rowsAffected: 0 });

    const result = await updateSupplierHandler({
      data: { id: "sup-999", name: "Ghost", contact: "", phone: "" },
      session: mockSession,
    });

    expect(result.ok).toBe(false);
  });
});

describe("deleteSupplierHandler", () => {
  it("deletes a supplier successfully", async () => {
    db.execute.mockResolvedValue({ rows: [], rowsAffected: 1 });

    const result = await deleteSupplierHandler({
      data: { id: "sup-1" },
      session: mockSession,
    });

    expect(result.ok).toBe(true);
  });

  it("returns error when supplier not found", async () => {
    db.execute.mockResolvedValue({ rows: [], rowsAffected: 0 });

    const result = await deleteSupplierHandler({
      data: { id: "sup-999" },
      session: mockSession,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/tidak ditemukan/);
  });
});

// ─── CRUD: Customers ────────────────────────────────────────────────────────
describe("createCustomerHandler", () => {
  it("creates a customer successfully", async () => {
    db.execute.mockResolvedValue({ rows: [], rowsAffected: 1 });

    const result = await createCustomerHandler({
      data: { name: "Customer A", phone: "08123", email: "a@test.com", address: "Jl. 1" },
      session: mockSession,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toMatch(/^cust_/);
  });
});

describe("updateCustomerHandler", () => {
  it("updates an existing customer", async () => {
    db.execute.mockResolvedValue({ rows: [], rowsAffected: 1 });

    const result = await updateCustomerHandler({
      data: { id: "cust-1", name: "Customer Updated", phone: "08456", email: "", address: "" },
      session: mockSession,
    });

    expect(result.ok).toBe(true);
  });

  it("returns false when customer not found", async () => {
    db.execute.mockResolvedValue({ rows: [], rowsAffected: 0 });

    const result = await updateCustomerHandler({
      data: { id: "cust-999", name: "Ghost", phone: "", email: "", address: "" },
      session: mockSession,
    });

    expect(result.ok).toBe(false);
  });
});

describe("deleteCustomerHandler", () => {
  it("deletes a customer successfully", async () => {
    db.execute.mockResolvedValue({ rows: [], rowsAffected: 1 });

    const result = await deleteCustomerHandler({
      data: { id: "cust-1" },
      session: mockSession,
    });

    expect(result.ok).toBe(true);
  });

  it("returns error when customer not found", async () => {
    db.execute.mockResolvedValue({ rows: [], rowsAffected: 0 });

    const result = await deleteCustomerHandler({
      data: { id: "cust-999" },
      session: mockSession,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/tidak ditemukan/);
  });
});

// ─── createStockTransferHandler ─────────────────────────────────────────────
describe("createStockTransferHandler", () => {
  it("transfers stock between outlets", async () => {
    db.execute.mockImplementation(({ sql }: { sql: string }) => {
      if (sql.includes("FROM product_stock") && sql.includes("WHERE product_id")) {
        return Promise.resolve({
          rows: [{ id: "stk-from-1", stock: 50 }],
          rowsAffected: 0,
        });
      }
      return Promise.resolve({ rows: [], rowsAffected: 1 });
    });

    const result = await createStockTransferHandler({
      data: {
        productId: "prod-1",
        fromOutletId: "out-1",
        toOutletId: "out-2",
        qty: 10,
      },
      session: mockSession,
    });

    expect(result.ok).toBe(true);
    expect(db.batch).toHaveBeenCalled();
  });

  it("rejects when source stock is insufficient", async () => {
    db.execute.mockImplementation(({ sql }: { sql: string }) => {
      if (sql.includes("FROM product_stock") && sql.includes("WHERE product_id")) {
        return Promise.resolve({
          rows: [{ id: "stk-from-1", stock: 5 }],
          rowsAffected: 0,
        });
      }
      return Promise.resolve({ rows: [], rowsAffected: 0 });
    });

    const result = await createStockTransferHandler({
      data: {
        productId: "prod-1",
        fromOutletId: "out-1",
        toOutletId: "out-2",
        qty: 10,
      },
      session: mockSession,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/tidak cukup/);
    expect(db.batch).not.toHaveBeenCalled();
  });

  it("rejects when source and target outlet are the same", async () => {
    const result = await createStockTransferHandler({
      data: {
        productId: "prod-1",
        fromOutletId: "out-1",
        toOutletId: "out-1",
        qty: 10,
      },
      session: mockSession,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/sama/);
    expect(db.batch).not.toHaveBeenCalled();
  });
});

// ─── createExpenseHandler ───────────────────────────────────────────────────
describe("createExpenseHandler", () => {
  it("creates an expense successfully", async () => {
    db.execute.mockResolvedValue({ rows: [], rowsAffected: 1 });

    const result = await createExpenseHandler({
      data: {
        expenseDate: "2026-06-09",
        category: "Operasional",
        note: "Listrik bulanan",
        amount: 500000,
      },
      session: mockSession,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toMatch(/^exp_/);
  });
});

// ─── createPurchaseOrderHandler ─────────────────────────────────────────────
describe("createPurchaseOrderHandler", () => {
  it("creates a purchase order with valid items", async () => {
    db.execute.mockResolvedValue({ rows: [], rowsAffected: 1 });

    const result = await createPurchaseOrderHandler({
      data: {
        supplierName: "Supplier A",
        notes: "Restock mingguan",
        items: [{ productId: "prod-1", name: "Kopi", qty: 10, unitCost: 12000 }],
      },
      session: mockSession,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.id).toMatch(/^po_/);
    expect(db.batch).toHaveBeenCalled();
  });
});
