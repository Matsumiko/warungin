import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  on,
  toRate,
  calculateTransactionTotals,
  csvEscape,
  rowsToDelimited,
  parseCsv,
  csvRecords,
  toInt,
  pdfEscape,
  makeSimplePdf,
  periodClause,
  exportLabel,
  exportFilename,
} from "./backoffice-utils";
import type { ExportFormat, ExportKind } from "./backoffice-utils";
import type { RealtimeEvent } from "./event-bus.server";

async function emitEvent(tenantId: string, event: RealtimeEvent): Promise<void> {
  const { emit } = await import("./event-bus.server");
  emit(tenantId, event);
}

export {
  on,
  toRate,
  calculateTransactionTotals,
  csvEscape,
  rowsToDelimited,
  parseCsv,
  csvRecords,
  toInt,
  pdfEscape,
  makeSimplePdf,
};

type SupplierRow = {
  id: string;
  name: string;
  contact: string;
  phone: string;
  debt: number;
  products_count: number;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  points: number;
  level: "Bronze" | "Silver" | "Gold" | "Platinum";
  total_spent: number;
};

type OutletRow = {
  id: string;
  name: string;
  address: string;
  phone: string;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "kasir" | "gudang" | "display";
  active: number;
};

type ExpenseRow = {
  id: string;
  expense_date: string;
  category: string;
  note: string;
  amount: number;
};

type PurchaseOrderRow = {
  id: string;
  supplier_name: string;
  order_date: string;
  status: string;
  total: number;
};

type PurchaseOrderItemRow = {
  id: string;
  purchase_order_id: string;
  product_id: string;
  product_name: string;
  qty: number;
  unit_cost: number;
  subtotal: number;
};

type PurchaseOrderProductRow = {
  id: string;
  name: string;
};

type DailySaleRow = {
  sales_date: string;
  sales: number;
  transactions: number;
};

type PaymentSummaryRow = {
  method: string;
  value: number;
  color: string;
};

type ShiftReportRow = {
  id: string;
  cashier_name: string;
  outlet_name: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number;
  sales: number;
  cash_diff: number;
};

type TransactionRow = {
  id: string;
  cashier_name: string;
  subtotal: number;
  tax: number;
  service_charge: number;
  total: number;
  cash_received: number;
  created_at: string;
};

type TransactionItemRow = {
  name: string;
  qty: number;
  price: number;
};

type StockTransferRow = {
  id: string;
  from_outlet: string;
  to_outlet: string;
  product_name: string;
  qty: number;
  note: string;
  status: string;
  created_by: string;
  created_at: string;
};

type ActiveShiftRow = {
  id: string;
  cashier_name: string;
  outlet_name: string;
  opened_at: string;
  opening_cash: number;
  cash_sales: number;
};

type TenantSettingRow = {
  key: string;
  value: string;
};

type ImportKind = "products" | "stock";

const tenantSettingDefaults = {
  businessType: "Retail Umum",
  address: "",
  phone: "",
  email: "",
  npwp: "",
  currency: "IDR",
  taxEnabled: "1",
  taxRate: "11",
  serviceCharge: "0",
  taxMode: "exclusive",
  rounding: "none",
  receiptPaper: "58mm",
  receiptLanguage: "id",
  receiptHeader: "",
  receiptFooter: "Terima kasih telah berbelanja\nBarang sudah dibeli tidak dapat ditukar",
  receiptShowLogo: "1",
  receiptShowCashier: "1",
  receiptShowQr: "1",
  receiptAutoPrint: "1",
  paymentCash: "1",
  paymentQris: "1",
  paymentCard: "1",
  paymentTransfer: "1",
  paymentGopay: "1",
  paymentOvo: "1",
  paymentDana: "1",
  paymentShopeepay: "0",
  splitPayment: "1",
  defaultPrinterId: "",
  printerConnection: "usb",
  printerEscpos: "1",
  printerCashDrawer: "1",
  printerKitchen: "0",
  notifyLowStock: "1",
  notifyOpenShift: "1",
  notifyRefundApproval: "1",
  notifyLatePo: "1",
  notifySalesDrop: "1",
  notifyCashDiff: "1",
  notifyExpiredProduct: "1",
  notificationEmail: "",
  pushNotifications: "1",
  theme: "dark-navy",
  appLanguage: "id",
  dateFormat: "DD/MM/YYYY",
  requirePinVoid: "1",
  requireRefundApproval: "1",
  autoLogoutIdle: "1",
  ownerTwoFactor: "0",
  maxSessionMinutes: "480",
} as const;

const tenantSettingKeys = new Set(Object.keys(tenantSettingDefaults));

async function id(prefix: string) {
  const { randomBytes } = await import("node:crypto");
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

async function hashPassword(password: string) {
  const { randomBytes, scryptSync } = await import("node:crypto");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export const getTenantSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
      SELECT key, value
      FROM tenant_settings
      WHERE tenant_id = ?
    `,
    args: [session.tenantId],
  });
  const settings: Record<string, string> = { ...tenantSettingDefaults };
  for (const row of result.rows) {
    const setting = row as unknown as TenantSettingRow;
    if (tenantSettingKeys.has(setting.key)) {
      settings[setting.key] = setting.value;
    }
  }
  return {
    storeName: session.tenantName,
    settings,
  };
});

export const updateTenantSettings = createServerFn({ method: "POST" })
  .validator(
    z.object({
      storeName: z.string().trim().min(2).max(120).optional(),
      settings: z.record(z.string(), z.string().max(1000)).default({}),
    }),
  )
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner", "manager"]);
    const db = getTursoClient();
    const entries = Object.entries(data.settings).filter(([key]) => tenantSettingKeys.has(key));
    if (!entries.length && !data.storeName?.trim()) {
      return { ok: false as const, message: "Tidak ada pengaturan yang berubah." };
    }
    await db.batch(
      [
        ...(data.storeName?.trim()
          ? [
              {
                sql: "UPDATE tenants SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                args: [data.storeName.trim(), session.tenantId],
              },
            ]
          : []),
        ...entries.map(([key, value]) => ({
          sql: `
            INSERT INTO tenant_settings (tenant_id, key, value, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(tenant_id, key) DO UPDATE SET
              value = excluded.value,
              updated_at = CURRENT_TIMESTAMP
          `,
          args: [session.tenantId, key, value],
        })),
        {
          sql: `
            INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
            VALUES (?, ?, ?, 'settings.updated', ?, ?)
          `,
          args: [
            await id("aud"),
            session.tenantId,
            session.name,
            "settings",
            `${entries.length} pengaturan diperbarui`,
          ],
        },
      ],
      "write",
    );
    return { ok: true as const };
  });

export const getSuppliers = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
    SELECT id, name, contact, phone, debt, products_count
    FROM suppliers
    WHERE tenant_id = ?
    ORDER BY name ASC
  `,
    args: [session.tenantId],
  });

  return result.rows.map((row) => {
    const supplier = row as unknown as SupplierRow;
    return {
      id: supplier.id,
      name: supplier.name,
      contact: supplier.contact,
      phone: supplier.phone,
      debt: Number(supplier.debt),
      products: Number(supplier.products_count),
    };
  });
});

export const createSupplier = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(2).max(160),
      contact: z.string().trim().max(120).default(""),
      phone: z.string().trim().max(40).default(""),
    }),
  )
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner", "manager", "gudang"]);
    const supplierId = await id("sup");
    await getTursoClient().execute({
      sql: `
        INSERT INTO suppliers (id, tenant_id, name, contact, phone)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [
        supplierId,
        session.tenantId,
        data.name.trim(),
        data.contact.trim(),
        data.phone.trim(),
      ],
    });
    return { ok: true as const, id: supplierId };
  });

export const updateSupplier = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(2).max(160),
      contact: z.string().trim().max(120).default(""),
      phone: z.string().trim().max(40).default(""),
    }),
  )
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner", "manager", "gudang"]);
    const result = await getTursoClient().execute({
      sql: `
        UPDATE suppliers
        SET name = ?, contact = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `,
      args: [data.name.trim(), data.contact.trim(), data.phone.trim(), data.id, session.tenantId],
    });
    return { ok: Number(result.rowsAffected) > 0 };
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(1), name: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner", "manager", "gudang"]);
    const db = getTursoClient();
    const poResult = await db.execute({
      sql: `
        SELECT COUNT(*) AS count
        FROM purchase_orders
        WHERE tenant_id = ? AND supplier_name = ?
      `,
      args: [session.tenantId, data.name.trim()],
    });
    if (Number(poResult.rows[0]?.count ?? 0) > 0) {
      return {
        ok: false as const,
        message: "Supplier masih dipakai purchase order.",
      };
    }
    await db.execute({
      sql: "DELETE FROM suppliers WHERE id = ? AND tenant_id = ?",
      args: [data.id, session.tenantId],
    });
    return { ok: true as const };
  });

export const getCustomers = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
    SELECT id, name, phone, points, level, total_spent
    FROM customers
    WHERE tenant_id = ?
    ORDER BY name ASC
  `,
    args: [session.tenantId],
  });

  return result.rows.map((row) => {
    const customer = row as unknown as CustomerRow;
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      points: Number(customer.points),
      level: customer.level,
      totalSpent: Number(customer.total_spent),
    };
  });
});

export const getCustomerDetail = createServerFn({ method: "GET" })
  .validator((customerId: string) => customerId)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner", "manager", "kasir"]);
    const result = await getTursoClient().execute({
      sql: `
        SELECT id, name, phone, points, level, total_spent
        FROM customers
        WHERE id = ? AND tenant_id = ?
        LIMIT 1
      `,
      args: [data, session.tenantId],
    });
    const customer = result.rows[0] as unknown as CustomerRow | undefined;
    if (!customer) return null;
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      points: Number(customer.points),
      level: customer.level,
      totalSpent: Number(customer.total_spent),
    };
  });

export const createCustomer = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(2).max(160),
      phone: z.string().trim().max(40).default(""),
    }),
  )
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner", "manager", "kasir"]);
    const customerId = await id("cus");
    await getTursoClient().execute({
      sql: `
        INSERT INTO customers (id, tenant_id, name, phone)
        VALUES (?, ?, ?, ?)
      `,
      args: [customerId, session.tenantId, data.name.trim(), data.phone.trim()],
    });
    return { ok: true as const, id: customerId };
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(2).max(160),
      phone: z.string().trim().max(40).default(""),
      points: z.number().int().min(0).default(0),
      level: z.enum(["Bronze", "Silver", "Gold", "Platinum"]).default("Bronze"),
    }),
  )
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner", "manager", "kasir"]);
    const result = await getTursoClient().execute({
      sql: `
        UPDATE customers
        SET name = ?, phone = ?, points = ?, level = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `,
      args: [
        data.name.trim(),
        data.phone.trim(),
        data.points,
        data.level,
        data.id,
        session.tenantId,
      ],
    });
    return { ok: Number(result.rowsAffected) > 0 };
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    const result = await getTursoClient().execute({
      sql: "DELETE FROM customers WHERE id = ? AND tenant_id = ?",
      args: [data.id, session.tenantId],
    });
    return { ok: Number(result.rowsAffected) > 0 };
  });

export const getOutlets = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
    SELECT id, name, address, phone
    FROM outlets
    WHERE active = 1 AND tenant_id = ?
    ORDER BY name ASC
  `,
    args: [session.tenantId],
  });

  return result.rows.map((row) => row as unknown as OutletRow);
});

export const createOutlet = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(2).max(160),
      address: z.string().trim().max(240).default(""),
      phone: z.string().trim().max(40).default(""),
    }),
  )
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    const outletId = await id("out");
    await getTursoClient().execute({
      sql: `
        INSERT INTO outlets (id, tenant_id, name, address, phone)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [outletId, session.tenantId, data.name.trim(), data.address.trim(), data.phone.trim()],
    });
    return { ok: true as const, id: outletId };
  });

export const updateOutlet = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(2).max(160),
      address: z.string().trim().max(240).default(""),
      phone: z.string().trim().max(40).default(""),
    }),
  )
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    const result = await getTursoClient().execute({
      sql: `
        UPDATE outlets
        SET name = ?, address = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `,
      args: [data.name.trim(), data.address.trim(), data.phone.trim(), data.id, session.tenantId],
    });
    return { ok: Number(result.rowsAffected) > 0 };
  });

export const deleteOutlet = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    const db = getTursoClient();
    const outletResult = await db.execute({
      sql: `
        SELECT id, name
        FROM outlets
        WHERE id = ? AND tenant_id = ? AND active = 1
        LIMIT 1
      `,
      args: [data.id, session.tenantId],
    });
    const outlet = outletResult.rows[0] as unknown as Pick<OutletRow, "id" | "name"> | undefined;
    if (!outlet) {
      return { ok: false as const, message: "Outlet tidak ditemukan." };
    }
    const shiftResult = await db.execute({
      sql: `
        SELECT COUNT(*) AS count
        FROM shift_reports
        WHERE tenant_id = ? AND outlet_name = ? AND closed_at IS NULL
      `,
      args: [session.tenantId, outlet.name],
    });
    if (Number(shiftResult.rows[0]?.count ?? 0) > 0) {
      return { ok: false as const, message: "Tutup shift aktif di outlet ini sebelum menghapus." };
    }
    const result = await db.execute({
      sql: `
        UPDATE outlets
        SET active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ? AND active = 1
      `,
      args: [data.id, session.tenantId],
    });
    return { ok: Number(result.rowsAffected) > 0 };
  });

export const getUsers = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireRole(["owner"]);
  const result = await getTursoClient().execute({
    sql: `
    SELECT id, name, email, role, active
    FROM app_users
    WHERE tenant_id = ?
    ORDER BY name ASC
  `,
    args: [session.tenantId],
  });

  return result.rows.map((row) => {
    const user = row as unknown as UserRow;
    return { ...user, active: user.active === 1 };
  });
});

export const createUser = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(180),
      password: z.string().min(8).max(128),
      role: z.enum(["manager", "kasir", "gudang", "display"]),
    }),
  )
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner"]);
    const userId = await id("usr");
    try {
      await getTursoClient().execute({
        sql: `
          INSERT INTO app_users (id, tenant_id, name, email, password_hash, role)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
          userId,
          session.tenantId,
          data.name.trim(),
          data.email.trim().toLowerCase(),
          await hashPassword(data.password),
          data.role,
        ],
      });
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
        return { ok: false as const, message: "Email sudah terdaftar." };
      }
      throw error;
    }
    return { ok: true as const, id: userId };
  });

export const getExpenses = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
    SELECT id, expense_date, category, note, amount
    FROM expenses
    WHERE tenant_id = ?
    ORDER BY expense_date DESC, created_at DESC
  `,
    args: [session.tenantId],
  });

  return result.rows.map((row) => {
    const expense = row as unknown as ExpenseRow;
    return {
      id: expense.id,
      date: expense.expense_date,
      category: expense.category,
      note: expense.note,
      amount: Number(expense.amount),
    };
  });
});

export const createExpense = createServerFn({ method: "POST" })
  .validator(
    z.object({
      expenseDate: z.string().trim().min(8).max(20),
      category: z.string().trim().min(2).max(80),
      note: z.string().trim().max(240).default(""),
      amount: z.number().int().min(0),
    }),
  )
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    const expenseId = await id("exp");
    await getTursoClient().execute({
      sql: `
        INSERT INTO expenses (id, tenant_id, expense_date, category, note, amount)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        expenseId,
        session.tenantId,
        data.expenseDate,
        data.category.trim(),
        data.note.trim(),
        data.amount,
      ],
    });
    return { ok: true as const, id: expenseId };
  });

export const getStockTransfers = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
      SELECT
        stock_transfers.id,
        from_outlets.name AS from_outlet,
        to_outlets.name AS to_outlet,
        products.name AS product_name,
        stock_transfers.qty,
        stock_transfers.note,
        stock_transfers.status,
        stock_transfers.created_by,
        stock_transfers.created_at
      FROM stock_transfers
      JOIN outlets AS from_outlets ON from_outlets.id = stock_transfers.from_outlet_id
      JOIN outlets AS to_outlets ON to_outlets.id = stock_transfers.to_outlet_id
      JOIN products ON products.id = stock_transfers.product_id
      WHERE stock_transfers.tenant_id = ?
      ORDER BY stock_transfers.created_at DESC
      LIMIT 50
    `,
    args: [session.tenantId],
  });
  return result.rows.map((row) => {
    const transfer = row as unknown as StockTransferRow;
    return {
      id: transfer.id,
      fromOutlet: transfer.from_outlet,
      toOutlet: transfer.to_outlet,
      productName: transfer.product_name,
      qty: Number(transfer.qty),
      note: transfer.note,
      status: transfer.status,
      createdBy: transfer.created_by,
      createdAt: transfer.created_at,
    };
  });
});

export const createStockTransfer = createServerFn({ method: "POST" })
  .validator(
    z.object({
      fromOutletId: z.string().trim().min(1),
      toOutletId: z.string().trim().min(1),
      productId: z.string().trim().min(1),
      qty: z.number().int().min(1),
      note: z.string().trim().max(240).default(""),
    }),
  )
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    if (data.fromOutletId === data.toOutletId) {
      return { ok: false as const, message: "Outlet asal dan tujuan harus berbeda." };
    }
    const db = getTursoClient();
    const [fromOutlet, toOutlet, product] = await Promise.all([
      db.execute({
        sql: "SELECT id, name FROM outlets WHERE id = ? AND tenant_id = ? AND active = 1 LIMIT 1",
        args: [data.fromOutletId, session.tenantId],
      }),
      db.execute({
        sql: "SELECT id, name FROM outlets WHERE id = ? AND tenant_id = ? AND active = 1 LIMIT 1",
        args: [data.toOutletId, session.tenantId],
      }),
      db.execute({
        sql: "SELECT id, name FROM products WHERE id = ? AND tenant_id = ? LIMIT 1",
        args: [data.productId, session.tenantId],
      }),
    ]);
    const fromName = String(fromOutlet.rows[0]?.name ?? "");
    const toName = String(toOutlet.rows[0]?.name ?? "");
    const productName = String(product.rows[0]?.name ?? "");
    if (!fromName || !toName || !productName) {
      return { ok: false as const, message: "Outlet atau produk tidak ditemukan." };
    }

    const transferId = await id("trf");
    await db.batch(
      [
        {
          sql: `
            INSERT INTO stock_transfers (
              id, tenant_id, from_outlet_id, to_outlet_id, product_id,
              qty, note, status, created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'requested', ?)
          `,
          args: [
            transferId,
            session.tenantId,
            data.fromOutletId,
            data.toOutletId,
            data.productId,
            data.qty,
            data.note.trim(),
            session.name,
          ],
        },
        {
          sql: `
            INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
            VALUES (?, ?, ?, 'stock.transfer.requested', ?, ?)
          `,
          args: [
            await id("aud"),
            session.tenantId,
            session.name,
            transferId,
            `${productName} x${data.qty} · ${fromName} → ${toName}${data.note ? ` · ${data.note.trim()}` : ""}`,
          ],
        },
      ],
      "write",
    );
    return { ok: true as const, id: transferId };
  });

export const getPurchaseOrders = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
    SELECT id, supplier_name, order_date, status, total
    FROM purchase_orders
    WHERE tenant_id = ?
    ORDER BY order_date DESC, created_at DESC
  `,
    args: [session.tenantId],
  });

  return result.rows.map((row) => {
    const order = row as unknown as PurchaseOrderRow;
    return {
      id: order.id,
      supplier: order.supplier_name,
      date: order.order_date,
      status: order.status,
      total: Number(order.total),
    };
  });
});

export const createPurchaseOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      supplierName: z.string().trim().min(2).max(160),
      orderDate: z.string().trim().min(8).max(20),
      status: z.enum(["draft", "sent"]).default("draft"),
      items: z
        .array(
          z.object({
            productId: z.string().trim().min(1),
            qty: z.number().int().min(1).max(1_000_000),
            unitCost: z.number().int().min(0).max(1_000_000_000),
          }),
        )
        .min(1)
        .max(100),
    }),
  )
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner", "manager", "gudang"]);
    const db = getTursoClient();
    const productIds = Array.from(new Set(data.items.map((item) => item.productId)));
    const placeholders = productIds.map(() => "?").join(", ");
    const productResult = await db.execute({
      sql: `
        SELECT id, name
        FROM products
        WHERE tenant_id = ? AND active = 1 AND id IN (${placeholders})
      `,
      args: [session.tenantId, ...productIds],
    });
    const products = new Map(
      productResult.rows.map((row) => {
        const product = row as unknown as PurchaseOrderProductRow;
        return [product.id, product];
      }),
    );
    for (const item of data.items) {
      if (!products.has(item.productId)) {
        return { ok: false as const, message: "Produk PO tidak ditemukan di katalog toko ini." };
      }
    }

    const orderId = await id("po");
    const total = data.items.reduce((sum, item) => sum + item.qty * item.unitCost, 0);
    await db.batch(
      [
        {
          sql: `
            INSERT INTO purchase_orders (id, tenant_id, supplier_name, order_date, status, total)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          args: [
            orderId,
            session.tenantId,
            data.supplierName.trim(),
            data.orderDate,
            data.status,
            total,
          ],
        },
        ...data.items.map((item) => {
          const product = products.get(item.productId);
          return {
            sql: `
              INSERT INTO purchase_order_items (
                id, purchase_order_id, tenant_id, product_id, product_name,
                qty, unit_cost, subtotal
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              crypto.randomUUID(),
              orderId,
              session.tenantId,
              item.productId,
              product?.name ?? "",
              item.qty,
              item.unitCost,
              item.qty * item.unitCost,
            ],
          };
        }),
      ],
      "write",
    );
    return { ok: true as const, id: orderId };
  });

export const getPurchaseOrderDetail = createServerFn({ method: "GET" })
  .validator((orderId: string) => orderId)
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    const db = getTursoClient();
    const [orderResult, itemResult] = await Promise.all([
      db.execute({
        sql: `
          SELECT id, supplier_name, order_date, status, total
          FROM purchase_orders
          WHERE id = ? AND tenant_id = ?
          LIMIT 1
        `,
        args: [data, session.tenantId],
      }),
      db.execute({
        sql: `
          SELECT id, purchase_order_id, product_id, product_name, qty, unit_cost, subtotal
          FROM purchase_order_items
          WHERE purchase_order_id = ? AND tenant_id = ?
          ORDER BY created_at ASC
        `,
        args: [data, session.tenantId],
      }),
    ]);
    const order = orderResult.rows[0] as unknown as PurchaseOrderRow | undefined;
    if (!order) return null;
    return {
      id: order.id,
      supplier: order.supplier_name,
      date: order.order_date,
      status: order.status,
      total: Number(order.total),
      items: itemResult.rows.map((row) => {
        const item = row as unknown as PurchaseOrderItemRow;
        return {
          id: item.id,
          orderId: item.purchase_order_id,
          productId: item.product_id,
          productName: item.product_name,
          qty: Number(item.qty),
          unitCost: Number(item.unit_cost),
          subtotal: Number(item.subtotal),
        };
      }),
    };
  });

export const updatePurchaseOrderStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().trim().min(1),
      status: z.enum(["draft", "sent", "received", "cancelled"]),
    }),
  )
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    const result = await getTursoClient().execute({
      sql: `
        UPDATE purchase_orders
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `,
      args: [data.status, data.id, session.tenantId],
    });
    if (Number(result.rowsAffected) === 0) {
      return { ok: false as const, message: "Purchase order tidak ditemukan." };
    }
    await getTursoClient().execute({
      sql: `
        INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
        VALUES (?, ?, ?, 'purchase_order.status_updated', ?, ?)
      `,
      args: [
        await id("aud"),
        session.tenantId,
        session.name,
        data.id,
        `Status PO diubah menjadi ${data.status}`,
      ],
    });
    return { ok: true as const };
  });

export const receivePurchaseOrder = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    const db = getTursoClient();
    const orderResult = await db.execute({
      sql: `
        SELECT id, status
        FROM purchase_orders
        WHERE id = ? AND tenant_id = ?
        LIMIT 1
      `,
      args: [data.id, session.tenantId],
    });
    const order = orderResult.rows[0] as unknown as { id: string; status: string } | undefined;
    if (!order) {
      return { ok: false as const, message: "Purchase order tidak ditemukan." };
    }
    if (order.status === "received") {
      return { ok: false as const, message: "Purchase order ini sudah pernah diterima." };
    }
    if (order.status === "cancelled") {
      return { ok: false as const, message: "Purchase order sudah dibatalkan." };
    }

    const itemResult = await db.execute({
      sql: `
        SELECT id, product_id, product_name, qty
        FROM purchase_order_items
        WHERE purchase_order_id = ? AND tenant_id = ?
      `,
      args: [data.id, session.tenantId],
    });
    const items = itemResult.rows.map(
      (row) =>
        row as unknown as {
          id: string;
          product_id: string;
          product_name: string;
          qty: number;
        },
    );
    if (!items.length) {
      return { ok: false as const, message: "PO belum punya item barang." };
    }

    const productIds = Array.from(new Set(items.map((item) => item.product_id)));
    const placeholders = productIds.map(() => "?").join(", ");
    const productResult = await db.execute({
      sql: `
        SELECT id, name, stock
        FROM products
        WHERE tenant_id = ? AND id IN (${placeholders})
      `,
      args: [session.tenantId, ...productIds],
    });
    if (productResult.rows.length !== productIds.length) {
      return { ok: false as const, message: "Ada produk PO yang tidak ditemukan di katalog." };
    }
    const productMap = new Map(
      productResult.rows.map((row) => {
        const p = row as unknown as { id: string; name: string; stock: number };
        return [p.id, p] as const;
      }),
    );

    // Find default outlet for per-outlet stock seeding
    const defaultOutlet = await db.execute({
      sql: "SELECT id FROM outlets WHERE tenant_id = ? AND active = 1 ORDER BY created_at ASC LIMIT 1",
      args: [session.tenantId],
    });
    const defaultOutletId = String(defaultOutlet.rows[0]?.id ?? "");
    const psIds = await Promise.all(items.map(() => id("ps")));

    await db.batch(
      [
        // Per-outlet stock upsert for default outlet
        ...(defaultOutletId
          ? items.map((item, i) => ({
              sql: `
                INSERT INTO product_stock (id, tenant_id, product_id, outlet_id, stock)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(tenant_id, product_id, outlet_id) DO UPDATE SET
                  stock = stock + excluded.stock, updated_at = CURRENT_TIMESTAMP
              `,
              args: [
                psIds[i],
                session.tenantId,
                item.product_id,
                defaultOutletId,
                Number(item.qty),
              ],
            }))
          : []),
        // Recalculate global aggregates for affected products
        ...[...new Set(items.map((i) => i.product_id))].map((productId) => ({
          sql: `
            UPDATE products
            SET stock = COALESCE((
              SELECT SUM(ps.stock) FROM product_stock ps
              WHERE ps.tenant_id = ? AND ps.product_id = ?
            ), 0),
            updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND tenant_id = ?
          `,
          args: [session.tenantId, productId, productId, session.tenantId],
        })),
        {
          sql: `
            UPDATE purchase_orders
            SET status = 'received', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND tenant_id = ? AND status NOT IN ('received', 'cancelled')
          `,
          args: [data.id, session.tenantId],
        },
        {
          sql: `
            INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
            VALUES (?, ?, ?, 'purchase_order.received', ?, ?)
          `,
          args: [
            await id("aud"),
            session.tenantId,
            session.name,
            data.id,
            `${items.length} item diterima · stok produk bertambah`,
          ],
        },
      ],
      "write",
    );
    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (product) {
        await emitEvent(session.tenantId, {
          type: "stock.changed",
          data: {
            productId: item.product_id,
            productName: product.name,
            newStock: product.stock + item.qty,
            oldStock: product.stock,
          },
          timestamp: Date.now(),
        });
      }
    }
    return { ok: true as const };
  });

export const getStockMutations = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
      SELECT id, occurred_at, user_name, target, detail
      FROM audit_logs
      WHERE tenant_id = ? AND action IN ('stock.adjusted', 'purchase_order.received')
      ORDER BY occurred_at DESC
      LIMIT 100
    `,
    args: [session.tenantId],
  });
  return result.rows.map(
    (row) =>
      row as unknown as {
        id: string;
        occurred_at: string;
        user_name: string;
        target: string;
        detail: string;
      },
  );
});

export const getSalesReport = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
    SELECT
      substr(created_at, 1, 10) AS sales_date,
      COALESCE(SUM(total), 0) AS sales,
      COUNT(*) AS transactions
    FROM transactions
    WHERE tenant_id = ?
      AND status = 'completed'
    GROUP BY substr(created_at, 1, 10)
    ORDER BY sales_date ASC
  `,
    args: [session.tenantId],
  });

  return result.rows.map((row) => {
    const sale = row as unknown as DailySaleRow;
    return {
      day: sale.sales_date,
      sales: Number(sale.sales),
      transactions: Number(sale.transactions),
    };
  });
});

export const getPaymentBreakdown = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
    SELECT
      payment_method AS method,
      COALESCE(SUM(total), 0) AS value
    FROM transactions
    WHERE tenant_id = ?
      AND status = 'completed'
      AND DATE(created_at) = DATE('now')
    GROUP BY payment_method
    ORDER BY value DESC, method ASC
  `,
    args: [session.tenantId],
  });

  const totalValue = result.rows.reduce((sum, row) => sum + Number(row.value), 0);
  const colors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  return result.rows.map((row, i) => ({
    method: String(row.method),
    value: totalValue > 0 ? Math.round((Number(row.value) / totalValue) * 100) : 0,
    color: colors[i % colors.length],
  }));
});

export const getShiftReports = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
    SELECT id, cashier_name, outlet_name, opened_at, closed_at, opening_cash, closing_cash, sales, cash_diff
    FROM shift_reports
    WHERE tenant_id = ?
    ORDER BY opened_at DESC
  `,
    args: [session.tenantId],
  });

  return result.rows.map((row) => {
    const shift = row as unknown as ShiftReportRow;
    return {
      id: shift.id,
      kasir: shift.cashier_name,
      outlet: shift.outlet_name,
      open: shift.opened_at,
      close: shift.closed_at ?? "",
      openingCash: Number(shift.opening_cash),
      closingCash: Number(shift.closing_cash),
      sales: Number(shift.sales),
      diff: Number(shift.cash_diff),
    };
  });
});

export const getActiveShift = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const db = getTursoClient();
  const shiftResult = await db.execute({
    sql: `
      SELECT id, cashier_name, outlet_name, opened_at, opening_cash
      FROM shift_reports
      WHERE tenant_id = ? AND closed_at IS NULL
      ORDER BY opened_at DESC
      LIMIT 1
    `,
    args: [session.tenantId],
  });
  const shift = shiftResult.rows[0] as unknown as Omit<ActiveShiftRow, "cash_sales"> | undefined;
  if (!shift) return null;

  // Resolve outlet_id from outlet_name for per-outlet stock
  const outletResult = await db.execute({
    sql: "SELECT id FROM outlets WHERE tenant_id = ? AND name = ? AND active = 1 LIMIT 1",
    args: [session.tenantId, shift.outlet_name],
  });
  const outletId = String(outletResult.rows[0]?.id ?? "");

  const salesResult = await db.execute({
    sql: `
      SELECT COALESCE(SUM(total), 0) AS cash_sales
      FROM transactions
      WHERE tenant_id = ?
        AND status = 'completed'
        AND payment_method = 'Cash'
        AND created_at >= ?
    `,
    args: [session.tenantId, shift.opened_at],
  });
  const cashSales = Number(salesResult.rows[0]?.cash_sales ?? 0);
  return {
    id: shift.id,
    kasir: shift.cashier_name,
    outlet: shift.outlet_name,
    outletId,
    open: shift.opened_at,
    openingCash: Number(shift.opening_cash),
    cashSales,
    expectedCash: Number(shift.opening_cash) + cashSales,
  };
});

export async function openShiftHandler({
  session,
  data,
}: {
  session: { tenantId: string; name: string };
  data: { openingCash: number; outletName: string };
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();
  const active = await db.execute({
    sql: "SELECT id FROM shift_reports WHERE tenant_id = ? AND closed_at IS NULL LIMIT 1",
    args: [session.tenantId],
  });
  if (active.rows.length) {
    return { ok: false, message: "Masih ada shift aktif yang belum ditutup." };
  }

  const shiftId = await id("shf");
  await db.batch(
    [
      {
        sql: `
          INSERT INTO shift_reports (
            id, tenant_id, cashier_name, outlet_name, opened_at, opening_cash
          )
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        `,
        args: [shiftId, session.tenantId, session.name, data.outletName.trim(), data.openingCash],
      },
      {
        sql: `
          INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
          VALUES (?, ?, ?, 'shift.opened', ?, ?)
        `,
        args: [
          await id("aud"),
          session.tenantId,
          session.name,
          shiftId,
          `Modal awal ${data.openingCash}`,
        ],
      },
    ],
    "write",
  );
  await emitEvent(session.tenantId, {
    type: "shift.opened",
    data: {
      shiftId,
      cashierName: session.name,
      outletName: data.outletName,
      openingCash: data.openingCash,
    },
    timestamp: Date.now(),
  });

  // Persist shift opened notification
  const notifId = await id("notif");
  await db.execute({
    sql: `INSERT INTO notifications (id, tenant_id, title, description, severity, type, is_read)
          VALUES (?, ?, ?, ?, 'info', 'shift_opened', 0)`,
    args: [
      notifId,
      session.tenantId,
      `Shift dibuka oleh ${session.name}`,
      `Outlet ${data.outletName} · Modal ${data.openingCash}`,
    ],
  });

  return { ok: true, id: shiftId };
}

export const openShift = createServerFn({ method: "POST" })
  .validator(
    z.object({
      openingCash: z.number().int().min(0),
      outletName: z.string().trim().min(1).max(160).default("Outlet Utama"),
    }),
  )
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const session = await requireRole(["owner", "manager", "kasir"]);
    return openShiftHandler({ session, data });
  });

export async function closeShiftHandler({
  session,
  data,
}: {
  session: { tenantId: string; name: string };
  data: { shiftId: string; actualCash: number };
}): Promise<{ ok: true; expectedCash: number; diff: number } | { ok: false; message: string }> {
  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();
  const shiftResult = await db.execute({
    sql: `
      SELECT id, opened_at, opening_cash
      FROM shift_reports
      WHERE id = ? AND tenant_id = ? AND closed_at IS NULL
      LIMIT 1
    `,
    args: [data.shiftId, session.tenantId],
  });
  const shift = shiftResult.rows[0] as unknown as
    | { id: string; opened_at: string; opening_cash: number }
    | undefined;
  if (!shift) return { ok: false, message: "Shift aktif tidak ditemukan." };

  const salesResult = await db.execute({
    sql: `
      SELECT COALESCE(SUM(total), 0) AS cash_sales
      FROM transactions
      WHERE tenant_id = ?
        AND status = 'completed'
        AND payment_method = 'Cash'
        AND created_at >= ?
    `,
    args: [session.tenantId, shift.opened_at],
  });
  const cashSales = Number(salesResult.rows[0]?.cash_sales ?? 0);
  const expectedCash = Number(shift.opening_cash) + cashSales;
  const diff = data.actualCash - expectedCash;

  await db.batch(
    [
      {
        sql: `
          UPDATE shift_reports
          SET closed_at = CURRENT_TIMESTAMP,
              closing_cash = ?,
              sales = ?,
              cash_diff = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND tenant_id = ?
        `,
        args: [data.actualCash, cashSales, diff, data.shiftId, session.tenantId],
      },
      {
        sql: `
          INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
          VALUES (?, ?, ?, 'shift.closed', ?, ?)
        `,
        args: [
          await id("aud"),
          session.tenantId,
          session.name,
          data.shiftId,
          `Expected ${expectedCash} · Actual ${data.actualCash} · Selisih ${diff}`,
        ],
      },
    ],
    "write",
  );
  await emitEvent(session.tenantId, {
    type: "shift.closed",
    data: {
      shiftId: data.shiftId,
      cashierName: session.name,
      expectedCash,
      actualCash: data.actualCash,
      diff,
    },
    timestamp: Date.now(),
  });

  // Notify on cash difference
  if (diff !== 0) {
    const notifId = await id("notif");
    await db.execute({
      sql: `INSERT INTO notifications (id, tenant_id, title, description, severity, type, is_read)
            VALUES (?, ?, ?, ?, ?, 'shift_closed', 0)`,
      args: [
        notifId,
        session.tenantId,
        diff > 0 ? "Selisih kas lebih" : "Selisih kas kurang",
        `Selisih ${diff > 0 ? "+" : ""}${diff} · Shift ${data.shiftId}`,
        diff > 0 ? "info" : "warning",
      ],
    });
  }

  return { ok: true, expectedCash, diff };
}

export const closeShift = createServerFn({ method: "POST" })
  .validator(
    z.object({
      shiftId: z.string().trim().min(1),
      actualCash: z.number().int().min(0),
    }),
  )
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const session = await requireRole(["owner", "manager", "kasir"]);
    return closeShiftHandler({ session, data });
  });

export const getProfitReport = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const db = getTursoClient();
  const [salesResult, expenseResult] = await Promise.all([
    db.execute({
      sql: "SELECT COALESCE(SUM(total), 0) AS total FROM transactions WHERE tenant_id = ? AND status = 'completed'",
      args: [session.tenantId],
    }),
    db.execute({
      sql: "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE tenant_id = ?",
      args: [session.tenantId],
    }),
  ]);

  const revenue = Number(salesResult.rows[0]?.total ?? 0);
  const opex = Number(expenseResult.rows[0]?.total ?? 0);

  return {
    revenue,
    cogs: 0,
    opex,
    gross: revenue,
    net: revenue - opex,
  };
});

export async function createTransactionHandler({
  data,
  session,
}: {
  data: {
    paymentMethod: string;
    cashReceived: number;
    subtotal: number;
    tax: number;
    serviceCharge: number;
    total: number;
    outletId?: string;
    items: Array<{
      productId: string;
      name: string;
      qty: number;
      price: number;
    }>;
  };
  session: { tenantId: string; name: string };
}) {
  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();
  const productIds = Array.from(new Set(data.items.map((item) => item.productId)));
  const placeholders = productIds.map(() => "?").join(", ");
  const [productResult, settingsResult] = await Promise.all([
    db.execute({
      sql: `
        SELECT id, name, stock, price
        FROM products
        WHERE tenant_id = ? AND id IN (${placeholders})
      `,
      args: [session.tenantId, ...productIds],
    }),
    db.execute({
      sql: `
        SELECT key, value
        FROM tenant_settings
        WHERE tenant_id = ? AND key IN ('taxEnabled', 'taxRate', 'taxMode', 'serviceCharge')
      `,
      args: [session.tenantId],
    }),
  ]);
  const products = new Map(
    productResult.rows.map((row) => {
      const product = row as unknown as {
        id: string;
        name: string;
        stock: number;
        price: number;
      };
      return [product.id, product];
    }),
  );
  const settings: Record<string, string> = { ...tenantSettingDefaults };
  for (const row of settingsResult.rows) {
    const setting = row as unknown as TenantSettingRow;
    settings[setting.key] = setting.value;
  }

  // Check stock availability — prefer per-outlet if outletId provided
  if (data.outletId) {
    for (const item of data.items) {
      const product = products.get(item.productId);
      if (!product) {
        return { ok: false as const, message: `${item.name} tidak ditemukan di katalog toko ini.` };
      }
      const stockResult = await db.execute({
        sql: "SELECT stock FROM product_stock WHERE tenant_id = ? AND product_id = ? AND outlet_id = ? LIMIT 1",
        args: [session.tenantId, item.productId, data.outletId],
      });
      const outletStock = Number(stockResult.rows[0]?.stock ?? 0);
      if (outletStock < item.qty) {
        return {
          ok: false as const,
          message: `Stok ${product.name} tidak cukup di outlet. Tersedia: ${outletStock}, diminta: ${item.qty}.`,
        };
      }
    }
  } else {
    for (const item of data.items) {
      const product = products.get(item.productId);
      if (!product) {
        return { ok: false as const, message: `${item.name} tidak ditemukan di katalog toko ini.` };
      }
      if (Number(product.stock) < item.qty) {
        return { ok: false as const, message: `Stok ${product.name} tidak cukup.` };
      }
    }
  }

  const expectedSubtotal = data.items.reduce((sum, item) => {
    const product = products.get(item.productId);
    return sum + Number(product?.price ?? 0) * item.qty;
  }, 0);
  const expectedTotals = calculateTransactionTotals(expectedSubtotal, settings);
  if (
    expectedSubtotal !== data.subtotal ||
    expectedTotals.tax !== data.tax ||
    expectedTotals.serviceCharge !== data.serviceCharge ||
    expectedTotals.total !== data.total
  ) {
    return { ok: false as const, message: "Total transaksi tidak valid." };
  }

  const transactionId = await id("trx");
  const statements = [
    {
      sql: `
        INSERT INTO transactions (
          id, tenant_id, cashier_name, subtotal, tax, service_charge, total,
          cash_received, payment_method, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
      `,
      args: [
        transactionId,
        session.tenantId,
        session.name,
        data.subtotal,
        data.tax,
        data.serviceCharge,
        data.total,
        data.cashReceived,
        data.paymentMethod.trim(),
      ],
    },
    ...data.items.map((item) => ({
      sql: `
        INSERT INTO transaction_items (id, transaction_id, tenant_id, name, qty, price)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        crypto.randomUUID(),
        transactionId,
        session.tenantId,
        item.name.trim(),
        item.qty,
        item.price,
      ],
    })),
    // Per-outlet stock decrement or global fallback
    ...(data.outletId
      ? (() => {
          const psDecrementIds = data.items.map(() => crypto.randomUUID());
          return data.items.map((item, i) => ({
            sql: `
              INSERT INTO product_stock (id, tenant_id, product_id, outlet_id, stock)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(tenant_id, product_id, outlet_id) DO UPDATE SET
                stock = MAX(0, stock - excluded.stock),
                updated_at = CURRENT_TIMESTAMP
            `,
            args: [psDecrementIds[i], session.tenantId, item.productId, data.outletId, item.qty],
          }));
        })()
      : data.items.map((item) => ({
          sql: `
            UPDATE products
            SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND tenant_id = ? AND stock >= ?
          `,
          args: [item.qty, item.productId, session.tenantId, item.qty],
        }))),
    // Recalculate global aggregates for each affected product
    ...[...new Set(data.items.map((i) => i.productId))].map((productId) => ({
      sql: `
        UPDATE products
        SET stock = COALESCE((
          SELECT SUM(ps.stock) FROM product_stock ps
          WHERE ps.tenant_id = ? AND ps.product_id = ?
        ), 0),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `,
      args: [session.tenantId, productId, productId, session.tenantId],
    })),
    {
      sql: `
        INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
        VALUES (?, ?, ?, 'checkout.completed', ?, ?)
      `,
      args: [
        await id("aud"),
        session.tenantId,
        session.name,
        transactionId,
        `${data.items.length} item · ${data.paymentMethod.trim()}`,
      ],
    },
  ];

  await db.batch(statements as { sql: string; args: (string | number)[] }[], "write");
  return { ok: true as const, id: transactionId };
}

export async function createSupplierHandler({
  data,
  session,
}: {
  data: { name: string; contact: string; phone: string };
  session: { tenantId: string };
}) {
  const { getTursoClient } = await import("./db/turso.server");
  const supplierId = await id("sup");
  await getTursoClient().execute({
    sql: `
      INSERT INTO suppliers (id, tenant_id, name, contact, phone)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [supplierId, session.tenantId, data.name.trim(), data.contact.trim(), data.phone.trim()],
  });
  return { ok: true as const, id: supplierId };
}

export async function updateSupplierHandler({
  data,
  session,
}: {
  data: { id: string; name: string; contact: string; phone: string };
  session: { tenantId: string };
}) {
  const { getTursoClient } = await import("./db/turso.server");
  const result = await getTursoClient().execute({
    sql: `
      UPDATE suppliers
      SET name = ?, contact = ?, phone = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `,
    args: [data.name.trim(), data.contact.trim(), data.phone.trim(), data.id, session.tenantId],
  });
  return { ok: Number(result.rowsAffected) > 0 };
}

export async function deleteSupplierHandler({
  data,
  session,
}: {
  data: { id: string };
  session: { tenantId: string };
}) {
  const { getTursoClient } = await import("./db/turso.server");
  const result = await getTursoClient().execute({
    sql: "DELETE FROM suppliers WHERE id = ? AND tenant_id = ?",
    args: [data.id, session.tenantId],
  });
  if (Number(result.rowsAffected) === 0) {
    return { ok: false as const, message: "Supplier tidak ditemukan" };
  }
  return { ok: true as const };
}

export async function createCustomerHandler({
  data,
  session,
}: {
  data: { name: string; phone: string; email: string; address: string };
  session: { tenantId: string };
}) {
  const { getTursoClient } = await import("./db/turso.server");
  const customerId = await id("cust");
  await getTursoClient().execute({
    sql: `
      INSERT INTO customers (id, tenant_id, name, phone, email, address)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [
      customerId,
      session.tenantId,
      data.name.trim(),
      data.phone.trim(),
      data.email.trim().toLowerCase(),
      data.address.trim(),
    ],
  });
  return { ok: true as const, id: customerId };
}

export async function updateCustomerHandler({
  data,
  session,
}: {
  data: { id: string; name: string; phone: string; email: string; address: string };
  session: { tenantId: string };
}) {
  const { getTursoClient } = await import("./db/turso.server");
  const result = await getTursoClient().execute({
    sql: `
      UPDATE customers
      SET name = ?, phone = ?, email = ?, address = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `,
    args: [
      data.name.trim(),
      data.phone.trim(),
      data.email.trim().toLowerCase(),
      data.address.trim(),
      data.id,
      session.tenantId,
    ],
  });
  return { ok: Number(result.rowsAffected) > 0 };
}

export async function deleteCustomerHandler({
  data,
  session,
}: {
  data: { id: string };
  session: { tenantId: string };
}) {
  const { getTursoClient } = await import("./db/turso.server");
  const result = await getTursoClient().execute({
    sql: "DELETE FROM customers WHERE id = ? AND tenant_id = ?",
    args: [data.id, session.tenantId],
  });
  if (Number(result.rowsAffected) === 0) {
    return { ok: false as const, message: "Customer tidak ditemukan" };
  }
  return { ok: true as const };
}

export async function createStockTransferHandler({
  data,
  session,
}: {
  data: {
    productId: string;
    fromOutletId: string;
    toOutletId: string;
    qty: number;
  };
  session: { tenantId: string };
}) {
  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();

  if (data.fromOutletId === data.toOutletId) {
    return { ok: false as const, message: "Outlet asal dan tujuan tidak boleh sama." };
  }

  const [stockResult] = await Promise.all([
    db.execute({
      sql: `
        SELECT id, stock FROM product_stock
        WHERE product_id = ? AND outlet_id = ? AND tenant_id = ?
      `,
      args: [data.productId, data.fromOutletId, session.tenantId],
    }),
  ]);

  const sourceStock = stockResult.rows[0] as unknown as { id: string; stock: number } | undefined;
  if (!sourceStock || Number(sourceStock.stock) < data.qty) {
    return { ok: false as const, message: "Stok outlet asal tidak cukup." };
  }

  const transferId = await id("xfer");
  await db.batch(
    [
      {
        sql: `
          UPDATE product_stock
          SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND tenant_id = ? AND stock >= ?
        `,
        args: [data.qty, sourceStock.id, session.tenantId, data.qty],
      },
      {
        sql: `
          INSERT INTO product_stock (id, tenant_id, product_id, outlet_id, stock)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(tenant_id, product_id, outlet_id) DO UPDATE SET
            stock = stock + excluded.stock,
            updated_at = CURRENT_TIMESTAMP
        `,
        args: [await id("stk"), session.tenantId, data.productId, data.toOutletId, data.qty],
      },
      // Recalculate global aggregate
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
        args: [session.tenantId, data.productId, data.productId, session.tenantId],
      },
      {
        sql: `
          INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
          VALUES (?, ?, ?, 'stock.transfer', ?, ?)
        `,
        args: [
          await id("aud"),
          session.tenantId,
          "system",
          transferId,
          `Transfer ${data.qty} item dari ${data.fromOutletId} ke ${data.toOutletId}`,
        ],
      },
    ],
    "write",
  );

  return { ok: true as const, id: transferId };
}

// --- Stock Transfer Approval ---

export const approveStockTransfer = createServerFn({ method: "POST" })
  .validator(z.object({ transferId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const session = await requireRole(["owner", "manager"]);
    const { getTursoClient } = await import("./db/turso.server");
    const db = getTursoClient();

    // Fetch the transfer
    const transferResult = await db.execute({
      sql: `SELECT id, from_outlet_id, to_outlet_id, product_id, qty, status
            FROM stock_transfers WHERE id = ? AND tenant_id = ? LIMIT 1`,
      args: [data.transferId, session.tenantId],
    });
    const transfer = transferResult.rows[0] as unknown as
      | {
          id: string;
          from_outlet_id: string;
          to_outlet_id: string;
          product_id: string;
          qty: number;
          status: string;
        }
      | undefined;
    if (!transfer) return { ok: false as const, message: "Transfer tidak ditemukan." };
    if (transfer.status !== "requested") {
      return { ok: false as const, message: "Transfer sudah diproses." };
    }

    // Check source stock
    const stockResult = await db.execute({
      sql: `SELECT id, stock FROM product_stock
            WHERE product_id = ? AND outlet_id = ? AND tenant_id = ?`,
      args: [transfer.product_id, transfer.from_outlet_id, session.tenantId],
    });
    const sourceStock = stockResult.rows[0] as unknown as { id: string; stock: number } | undefined;
    if (!sourceStock || Number(sourceStock.stock) < transfer.qty) {
      return { ok: false as const, message: "Stok outlet asal tidak cukup." };
    }

    // Execute stock movement
    await db.batch(
      [
        // Decrement source
        {
          sql: `UPDATE product_stock SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND tenant_id = ? AND stock >= ?`,
          args: [transfer.qty, sourceStock.id, session.tenantId, transfer.qty],
        },
        // Upsert destination
        {
          sql: `INSERT INTO product_stock (id, tenant_id, product_id, outlet_id, stock)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(tenant_id, product_id, outlet_id) DO UPDATE SET
                  stock = stock + excluded.stock, updated_at = CURRENT_TIMESTAMP`,
          args: [
            `stk_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
            session.tenantId,
            transfer.product_id,
            transfer.to_outlet_id,
            transfer.qty,
          ],
        },
        // Recalculate global aggregate
        {
          sql: `UPDATE products SET stock = COALESCE((
            SELECT SUM(ps.stock) FROM product_stock ps
            WHERE ps.tenant_id = ? AND ps.product_id = ?
          ), 0), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`,
          args: [session.tenantId, transfer.product_id, transfer.product_id, session.tenantId],
        },
        // Update transfer status
        {
          sql: `UPDATE stock_transfers SET status = 'executed', updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND tenant_id = ?`,
          args: [data.transferId, session.tenantId],
        },
        // Audit log
        {
          sql: `INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
                VALUES (?, ?, ?, 'stock.transfer', ?, ?)`,
          args: [
            await id("aud"),
            session.tenantId,
            session.name,
            transfer.product_id,
            `Transfer ${transfer.qty} item dari outlet asal ke outlet tujuan`,
          ],
        },
      ],
      "write",
    );

    return { ok: true as const };
  });

export async function createExpenseHandler({
  data,
  session,
}: {
  data: {
    expenseDate: string;
    category: string;
    note: string;
    amount: number;
  };
  session: { tenantId: string; name: string };
}) {
  const { getTursoClient } = await import("./db/turso.server");
  const expenseId = await id("exp");
  await getTursoClient().execute({
    sql: `
      INSERT INTO expenses (id, tenant_id, expense_date, category, note, amount)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [
      expenseId,
      session.tenantId,
      data.expenseDate.trim(),
      data.category.trim(),
      data.note.trim(),
      data.amount,
    ],
  });
  return { ok: true as const, id: expenseId };
}

export async function createPurchaseOrderHandler({
  data,
  session,
}: {
  data: {
    supplierName: string;
    notes: string;
    items: Array<{ productId: string; name: string; qty: number; unitCost: number }>;
  };
  session: { tenantId: string; name: string };
}) {
  const { getTursoClient } = await import("./db/turso.server");
  const db = getTursoClient();
  const totalCost = data.items.reduce((sum, item) => sum + item.qty * item.unitCost, 0);
  const poId = await id("po");

  const itemStatements = await Promise.all(
    data.items.map(async (item) => ({
      sql: `
        INSERT INTO purchase_order_items (id, po_id, tenant_id, product_id, product_name, qty, unit_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        await id("poi"),
        poId,
        session.tenantId,
        item.productId,
        item.name.trim(),
        item.qty,
        item.unitCost,
      ],
    })),
  );

  await db.batch(
    [
      {
        sql: `
          INSERT INTO purchase_orders (id, tenant_id, supplier_name, notes, total_cost, status, created_by)
          VALUES (?, ?, ?, ?, ?, 'draft', ?)
        `,
        args: [
          poId,
          session.tenantId,
          data.supplierName.trim(),
          data.notes.trim(),
          totalCost,
          session.name,
        ],
      },
      ...itemStatements,
    ],
    "write",
  );

  return { ok: true as const, id: poId };
}

export const createTransaction = createServerFn({ method: "POST" })
  .validator(
    z.object({
      paymentMethod: z.string().trim().min(1).max(40),
      cashReceived: z.number().int().min(0),
      subtotal: z.number().int().min(0),
      tax: z.number().int().min(0),
      serviceCharge: z.number().int().min(0).default(0),
      total: z.number().int().min(0),
      outletId: z.string().trim().min(1).optional(),
      customerId: z.string().trim().min(1).optional(),
      pointsRedeemed: z.number().int().min(0).default(0),
      items: z
        .array(
          z.object({
            productId: z.string().trim().min(1),
            name: z.string().trim().min(1).max(160),
            qty: z.number().int().min(1),
            price: z.number().int().min(0),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner", "manager", "kasir"]);
    const db = getTursoClient();
    const productIds = Array.from(new Set(data.items.map((item) => item.productId)));
    const placeholders = productIds.map(() => "?").join(", ");
    const [productResult, settingsResult] = await Promise.all([
      db.execute({
        sql: `
          SELECT id, name, stock, min_stock, price, unit
          FROM products
          WHERE tenant_id = ? AND id IN (${placeholders})
        `,
        args: [session.tenantId, ...productIds],
      }),
      db.execute({
        sql: `
          SELECT key, value
          FROM tenant_settings
          WHERE tenant_id = ? AND key IN ('taxEnabled', 'taxRate', 'taxMode', 'serviceCharge')
        `,
        args: [session.tenantId],
      }),
    ]);
    const products = new Map(
      productResult.rows.map((row) => {
        const product = row as unknown as {
          id: string;
          name: string;
          stock: number;
          min_stock: number;
          price: number;
          unit: string;
        };
        return [product.id, product];
      }),
    );
    const settings: Record<string, string> = { ...tenantSettingDefaults };
    for (const row of settingsResult.rows) {
      const setting = row as unknown as TenantSettingRow;
      settings[setting.key] = setting.value;
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

    // Per-outlet stock validation when outlet is known
    if (outletId) {
      for (const item of data.items) {
        const stockResult = await db.execute({
          sql: "SELECT stock FROM product_stock WHERE tenant_id = ? AND product_id = ? AND outlet_id = ? LIMIT 1",
          args: [session.tenantId, item.productId, outletId],
        });
        const outletStock = Number(stockResult.rows[0]?.stock ?? 0);
        if (outletStock < item.qty) {
          return { ok: false as const, message: `Stok ${item.name} tidak cukup di outlet.` };
        }
      }
    } else {
      for (const item of data.items) {
        const product = products.get(item.productId);
        if (!product) {
          return {
            ok: false as const,
            message: `${item.name} tidak ditemukan di katalog toko ini.`,
          };
        }
        if (Number(product.stock) < item.qty) {
          return { ok: false as const, message: `Stok ${product.name} tidak cukup.` };
        }
      }
    }

    const expectedSubtotal = data.items.reduce((sum, item) => {
      const product = products.get(item.productId);
      return sum + Number(product?.price ?? 0) * item.qty;
    }, 0);
    const expectedTotals = calculateTransactionTotals(expectedSubtotal, settings);
    if (
      expectedSubtotal !== data.subtotal ||
      expectedTotals.tax !== data.tax ||
      expectedTotals.serviceCharge !== data.serviceCharge ||
      expectedTotals.total !== data.total
    ) {
      return { ok: false as const, message: "Total transaksi tidak valid." };
    }

    const transactionId = await id("trx");
    const statements = [
      {
        sql: `
          INSERT INTO transactions (
            id, tenant_id, cashier_name, customer_id, subtotal, tax, service_charge, total,
            cash_received, payment_method, status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
        `,
        args: [
          transactionId,
          session.tenantId,
          session.name,
          data.customerId || null,
          data.subtotal,
          data.tax,
          data.serviceCharge,
          data.total,
          data.cashReceived,
          data.paymentMethod.trim(),
        ],
      },
      ...data.items.map((item) => ({
        sql: `
          INSERT INTO transaction_items (id, transaction_id, tenant_id, name, qty, price)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          transactionId,
          session.tenantId,
          item.name.trim(),
          item.qty,
          item.price,
        ],
      })),
      // Per-outlet stock decrement
      ...(outletId
        ? (() => {
            const psIds = data.items.map(() => crypto.randomUUID());
            return data.items.map((item, i) => ({
              sql: `
                INSERT INTO product_stock (id, tenant_id, product_id, outlet_id, stock)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(tenant_id, product_id, outlet_id) DO UPDATE SET
                  stock = MAX(0, stock - excluded.stock),
                  updated_at = CURRENT_TIMESTAMP
              `,
              args: [psIds[i], session.tenantId, item.productId, outletId, item.qty],
            }));
          })()
        : []),
      // Recalculate global aggregates for each affected product
      ...[...new Set(data.items.map((i) => i.productId))].map((productId) => ({
        sql: `
          UPDATE products
          SET stock = COALESCE((
            SELECT SUM(ps.stock) FROM product_stock ps
            WHERE ps.tenant_id = ? AND ps.product_id = ?
          ), 0),
          updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND tenant_id = ?
        `,
        args: [session.tenantId, productId, productId, session.tenantId],
      })),
      {
        sql: `
          INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
          VALUES (?, ?, ?, 'checkout.completed', ?, ?)
        `,
        args: [
          await id("aud"),
          session.tenantId,
          session.name,
          transactionId,
          `${data.items.length} item · ${data.paymentMethod.trim()}`,
        ],
      },
    ];

    await db.batch(statements, "write");

    // Customer loyalty: earn points and update total_spent
    if (data.customerId) {
      const pointsEarned = Math.floor(data.total / 10_000); // 1 point per Rp 10,000
      const pointsToApply = pointsEarned - data.pointsRedeemed;
      await db.execute({
        sql: `UPDATE customers
              SET total_spent = total_spent + ?,
                  points = MAX(0, points + ?),
                  level = CASE
                    WHEN total_spent + ? >= 20000000 THEN 'Platinum'
                    WHEN total_spent + ? >= 5000000 THEN 'Gold'
                    WHEN total_spent + ? >= 1000000 THEN 'Silver'
                    ELSE 'Bronze'
                  END,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND tenant_id = ?`,
        args: [
          data.total,
          pointsToApply,
          data.total,
          data.total,
          data.total,
          data.customerId,
          session.tenantId,
        ],
      });
    }

    // Emit real-time events
    for (const item of data.items) {
      const product = products.get(item.productId);
      if (product) {
        const newStock = Number(product.stock) - item.qty;
        await emitEvent(session.tenantId, {
          type: "stock.changed",
          data: {
            productId: item.productId,
            productName: product.name,
            newStock,
            oldStock: Number(product.stock),
          },
          timestamp: Date.now(),
        });
        if (newStock < Number(product.min_stock)) {
          await emitEvent(session.tenantId, {
            type: "low.stock",
            data: {
              productId: item.productId,
              productName: product.name,
              currentStock: newStock,
              minStock: Number(product.min_stock),
            },
            timestamp: Date.now(),
          });
          // Persist low-stock notification
          const notifId = await id("notif");
          await db.execute({
            sql: `INSERT INTO notifications (id, tenant_id, title, description, severity, type, is_read)
                  VALUES (?, ?, ?, ?, 'warning', 'low_stock', 0)`,
            args: [
              notifId,
              session.tenantId,
              `Stok ${product.name} menipis`,
              `Sisa ${newStock} ${product.unit ?? "pcs"}, minimum ${product.min_stock}`,
            ],
          });
        }
      }
    }
    await emitEvent(session.tenantId, {
      type: "transaction.completed",
      data: {
        transactionId,
        total: data.total,
        paymentMethod: data.paymentMethod,
        cashierName: session.name,
        itemCount: data.items.length,
      },
      timestamp: Date.now(),
    });

    return { ok: true as const, id: transactionId };
  });

export const getReceipt = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    const db = getTursoClient();
    const [transactionResult, itemsResult] = await Promise.all([
      db.execute({
        sql: `
          SELECT id, cashier_name, subtotal, tax, service_charge, total, cash_received, created_at
          FROM transactions
          WHERE id = ? AND tenant_id = ?
          LIMIT 1
        `,
        args: [data, session.tenantId],
      }),
      db.execute({
        sql: `
          SELECT name, qty, price
          FROM transaction_items
          WHERE transaction_id = ? AND tenant_id = ?
          ORDER BY created_at ASC
        `,
        args: [data, session.tenantId],
      }),
    ]);

    const transaction = transactionResult.rows[0] as unknown as TransactionRow | undefined;
    if (!transaction) return null;

    return {
      id: transaction.id,
      cashierName: transaction.cashier_name,
      subtotal: Number(transaction.subtotal),
      tax: Number(transaction.tax),
      serviceCharge: Number(transaction.service_charge),
      total: Number(transaction.total),
      cashReceived: Number(transaction.cash_received),
      createdAt: transaction.created_at,
      items: itemsResult.rows.map((row) => {
        const item = row as unknown as TransactionItemRow;
        return {
          name: item.name,
          qty: Number(item.qty),
          price: Number(item.price),
        };
      }),
    };
  });

export const getLatestTransaction = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
      SELECT id
      FROM transactions
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    args: [session.tenantId],
  });

  const id = result.rows[0]?.id;
  if (!id || typeof id !== "string") return null;
  return getReceipt({ data: id });
});

export const getAuditLogs = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireRole(["owner", "manager"]);
  const result = await getTursoClient().execute({
    sql: `
      SELECT id, occurred_at, user_name, action, target, detail
      FROM audit_logs
      WHERE tenant_id = ?
      ORDER BY occurred_at DESC
    `,
    args: [session.tenantId],
  });
  return result.rows.map(
    (row) =>
      row as unknown as {
        id: string;
        occurred_at: string;
        user_name: string;
        action: string;
        target: string;
        detail: string;
      },
  );
});

export const getImportExportActivity = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireRole(["owner", "manager", "gudang"]);
  const result = await getTursoClient().execute({
    sql: `
      SELECT id, occurred_at, action, target, detail
      FROM audit_logs
      WHERE tenant_id = ?
        AND (action LIKE 'import.%' OR action LIKE 'export.%')
      ORDER BY occurred_at DESC
      LIMIT 20
    `,
    args: [session.tenantId],
  });

  return result.rows.map((row) => {
    const activity = row as unknown as {
      id: string;
      occurred_at: string;
      action: string;
      target: string;
      detail: string;
    };
    return {
      id: activity.id,
      occurredAt: activity.occurred_at,
      action: activity.action,
      target: activity.target,
      detail: activity.detail,
      type: activity.action.startsWith("export.") ? ("export" as const) : ("import" as const),
      status: activity.action.endsWith(".failed") ? ("error" as const) : ("success" as const),
    };
  });
});

const exportDataInput = z.object({
  kind: z.enum(["products", "transactions", "shifts", "stock"]),
  format: z.enum(["CSV", "Excel", "PDF"]),
  period: z.string().trim().max(40).default("bulan-ini"),
});

const importCsvInput = z.object({
  kind: z.enum(["products", "stock"]),
  filename: z.string().trim().min(1).max(160),
  content: z.string().max(5_250_000),
  skipRows: z.array(z.number().int().min(0)).optional(),
});

// --- CSV Import Preview ---

type ImportRowStatus = "ok" | "warn" | "error";
type ImportRowValidation = {
  rowNumber: number;
  data: Record<string, string>;
  status: ImportRowStatus;
  messages: string[];
};
type ImportValidationResult = {
  rows: ImportRowValidation[];
  summary: { total: number; ok: number; warn: number; error: number };
};

export const validateImportCsv = createServerFn({ method: "POST" })
  .validator(z.object({ kind: z.enum(["products", "stock"]), content: z.string().max(5_250_000) }))
  .handler(async ({ data }): Promise<ImportValidationResult> => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner", "manager", "gudang"]);
    const db = getTursoClient();
    const kind = data.kind as ImportKind;
    const rawRows = csvRecords(data.content);

    if (!rawRows.length) {
      return { rows: [], summary: { total: 0, ok: 0, warn: 0, error: 0 } };
    }

    const rows: ImportRowValidation[] = [];

    if (kind === "products") {
      // Collect file-internal SKUs for duplicate detection
      const fileSkus = new Map<string, number>();
      for (const row of rawRows) {
        const sku = row.sku?.trim();
        if (sku) fileSkus.set(sku, (fileSkus.get(sku) ?? 0) + 1);
      }

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rowNum = i + 2; // header is row 1
        const messages: string[] = [];
        let status: ImportRowStatus = "ok";

        const name = row.name || row.nama;
        const sku = row.sku?.trim();

        if (!name) {
          messages.push("Nama produk wajib diisi");
          status = "error";
        }
        if (!sku) {
          messages.push("SKU wajib diisi");
          status = "error";
        }

        if (sku && (fileSkus.get(sku) ?? 0) > 1) {
          messages.push(`SKU "${sku}" duplikat di file ini`);
          if (status !== "error") status = "warn";
        }

        const price = toInt(row.price ?? row.harga);
        const cost = toInt(row.cost ?? row.modal);
        if (price === 0) {
          messages.push("Harga jual 0 — periksa kembali");
          if (status !== "error") status = "warn";
        }
        if (cost > price && price > 0) {
          messages.push("Harga modal lebih besar dari harga jual");
          if (status !== "error") status = "warn";
        }

        const stockVal = toInt(row.stock ?? row.stok);
        if (stockVal < 0) {
          messages.push("Stok tidak boleh negatif");
          status = "error";
        }

        rows.push({ rowNumber: rowNum, data: row, status, messages });
      }
    }

    if (kind === "stock") {
      // Collect SKUs from DB for existence check
      const dbSkus = new Set<string>();
      const skuResult = await db.execute({
        sql: "SELECT sku FROM products WHERE tenant_id = ?",
        args: [session.tenantId],
      });
      for (const r of skuResult.rows) dbSkus.add(String(r.sku));

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rowNum = i + 2;
        const messages: string[] = [];
        let status: ImportRowStatus = "ok";

        const sku = row.sku?.trim();
        if (!sku) {
          messages.push("SKU wajib diisi");
          status = "error";
        } else if (!dbSkus.has(sku)) {
          messages.push(`SKU "${sku}" tidak ditemukan di database`);
          status = "error";
        }

        const stock = toInt(row.stock ?? row.stok);
        if (stock < 0) {
          messages.push("Stok tidak boleh negatif");
          status = "error";
        }

        rows.push({ rowNumber: rowNum, data: row, status, messages });
      }
    }

    const summary = {
      total: rows.length,
      ok: rows.filter((r) => r.status === "ok").length,
      warn: rows.filter((r) => r.status === "warn").length,
      error: rows.filter((r) => r.status === "error").length,
    };

    return { rows, summary };
  });

export const exportTenantData = createServerFn({ method: "POST" })
  .validator(exportDataInput)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner", "manager", "gudang"]);
    const db = getTursoClient();
    const kind = data.kind as ExportKind;
    const format = data.format as ExportFormat;
    const label = exportLabel(kind);
    let rows: Array<Record<string, string | number>> = [];

    if (kind === "products") {
      const result = await db.execute({
        sql: `
          SELECT p.name, p.sku, p.barcode, c.name AS category, p.price, p.cost,
                 p.stock, p.min_stock, p.unit, p.active
          FROM products p
          LEFT JOIN categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
          WHERE p.tenant_id = ?
          ORDER BY p.name ASC
        `,
        args: [session.tenantId],
      });
      rows = result.rows.map((row) => {
        const product = row as unknown as {
          name: string;
          sku: string;
          barcode: string;
          category: string | null;
          price: number;
          cost: number;
          stock: number;
          min_stock: number;
          unit: string;
          active: number;
        };
        return {
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          category: product.category ?? "",
          price: Number(product.price),
          cost: Number(product.cost),
          stock: Number(product.stock),
          min_stock: Number(product.min_stock),
          unit: product.unit,
          active: product.active === 1 ? "yes" : "no",
        };
      });
    }

    if (kind === "transactions") {
      const filter = periodClause(data.period, "created_at");
      const result = await db.execute({
        sql: `
          SELECT id, cashier_name, subtotal, tax, service_charge, total,
                 cash_received, payment_method, status, created_at
          FROM transactions
          WHERE tenant_id = ?${filter.sql}
          ORDER BY created_at DESC
        `,
        args: [session.tenantId, ...filter.args],
      });
      rows = result.rows.map((row) => {
        const transaction = row as unknown as {
          id: string;
          cashier_name: string;
          subtotal: number;
          tax: number;
          service_charge: number;
          total: number;
          cash_received: number;
          payment_method: string;
          status: string;
          created_at: string;
        };
        return {
          id: transaction.id,
          cashier: transaction.cashier_name,
          subtotal: Number(transaction.subtotal),
          tax: Number(transaction.tax),
          service_charge: Number(transaction.service_charge),
          total: Number(transaction.total),
          cash_received: Number(transaction.cash_received),
          payment_method: transaction.payment_method,
          status: transaction.status,
          created_at: transaction.created_at,
        };
      });
    }

    if (kind === "shifts") {
      const filter = periodClause(data.period, "opened_at");
      const result = await db.execute({
        sql: `
          SELECT id, cashier_name, outlet_name, opened_at, closed_at, opening_cash,
                 closing_cash, sales, cash_diff
          FROM shift_reports
          WHERE tenant_id = ?${filter.sql}
          ORDER BY opened_at DESC
        `,
        args: [session.tenantId, ...filter.args],
      });
      rows = result.rows.map((row) => {
        const shift = row as unknown as ShiftReportRow;
        return {
          id: shift.id,
          cashier: shift.cashier_name,
          outlet: shift.outlet_name,
          opened_at: shift.opened_at,
          closed_at: shift.closed_at ?? "",
          opening_cash: Number(shift.opening_cash),
          closing_cash: Number(shift.closing_cash),
          sales: Number(shift.sales),
          cash_diff: Number(shift.cash_diff),
        };
      });
    }

    if (kind === "stock") {
      const result = await db.execute({
        sql: `
          SELECT p.name, p.sku, c.name AS category, p.stock, p.min_stock, p.unit, p.updated_at
          FROM products p
          LEFT JOIN categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
          WHERE p.tenant_id = ?
          ORDER BY p.name ASC
        `,
        args: [session.tenantId],
      });
      rows = result.rows.map((row) => {
        const product = row as unknown as {
          name: string;
          sku: string;
          category: string | null;
          stock: number;
          min_stock: number;
          unit: string;
          updated_at: string;
        };
        return {
          name: product.name,
          sku: product.sku,
          category: product.category ?? "",
          stock: Number(product.stock),
          min_stock: Number(product.min_stock),
          unit: product.unit,
          updated_at: product.updated_at,
        };
      });
    }

    const fallbackRows = rows.length ? rows : [{ info: "Belum ada data untuk diekspor" }];
    const content =
      format === "PDF"
        ? makeSimplePdf(
            `${label} Warungin`,
            fallbackRows.map((row) =>
              Object.entries(row)
                .map(([key, value]) => `${key}: ${value}`)
                .join(" | "),
            ),
          )
        : rowsToDelimited(fallbackRows, format === "Excel" ? "\t" : ",");
    const mime =
      format === "PDF"
        ? "application/pdf"
        : format === "Excel"
          ? "application/vnd.ms-excel"
          : "text/csv;charset=utf-8";
    const filename = exportFilename(kind, format);

    await db.execute({
      sql: `
        INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [
        await id("aud"),
        session.tenantId,
        session.name,
        "export.completed",
        label,
        `${format} · ${rows.length} baris · ${data.period}`,
      ],
    });

    return { ok: true as const, filename, mime, content, rows: rows.length };
  });

export const importTenantCsv = createServerFn({ method: "POST" })
  .validator(importCsvInput)
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner", "manager", "gudang"]);
    const db = getTursoClient();
    const kind = data.kind as ImportKind;
    let rows = csvRecords(data.content);

    // Filter out skipped rows (0-indexed)
    if (data.skipRows?.length) {
      const skipSet = new Set(data.skipRows);
      rows = rows.filter((_, index) => !skipSet.has(index));
    }

    if (!rows.length) {
      await db.execute({
        sql: `
          INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
          VALUES (?, ?, ?, 'import.failed', ?, ?)
        `,
        args: [
          await id("aud"),
          session.tenantId,
          session.name,
          kind === "products" ? "Produk" : "Stok",
          `${data.filename} tidak memiliki baris data`,
        ],
      });
      return { ok: false as const, message: "CSV tidak memiliki baris data." };
    }

    if (kind === "products") {
      // Find default outlet for per-outlet stock seeding
      const defaultOutlet = await db.execute({
        sql: "SELECT id FROM outlets WHERE tenant_id = ? AND active = 1 ORDER BY created_at ASC LIMIT 1",
        args: [session.tenantId],
      });
      const defaultOutletId = String(defaultOutlet.rows[0]?.id ?? "");

      let created = 0;
      let updated = 0;
      const statements = [];

      for (const row of rows) {
        const name = row.name || row.nama;
        const sku = row.sku;
        if (!name || !sku) continue;

        const categoryName = row.category || row.kategori || "Umum";
        const categoryResult = await db.execute({
          sql: `
            SELECT id
            FROM categories
            WHERE tenant_id = ? AND lower(name) = lower(?)
            LIMIT 1
          `,
          args: [session.tenantId, categoryName],
        });
        let categoryId = String(categoryResult.rows[0]?.id ?? "");
        if (!categoryId) {
          categoryId = await id("cat");
          statements.push({
            sql: `
              INSERT INTO categories (id, tenant_id, name, icon, color)
              VALUES (?, ?, ?, '🏷️', 'var(--color-primary)')
            `,
            args: [categoryId, session.tenantId, categoryName],
          });
        }

        const existing = await db.execute({
          sql: "SELECT id FROM products WHERE tenant_id = ? AND sku = ? LIMIT 1",
          args: [session.tenantId, sku],
        });
        const productId = String(existing.rows[0]?.id ?? "");
        const active = !["0", "no", "false", "nonaktif"].includes(
          String(row.active ?? row.aktif ?? "yes").toLowerCase(),
        );
        const stockVal = toInt(row.stock ?? row.stok);

        if (productId) {
          updated += 1;
          statements.push({
            sql: `
              UPDATE products
              SET name = ?, barcode = ?, category_id = ?, price = ?, cost = ?,
                  stock = ?, min_stock = ?, unit = ?, active = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND tenant_id = ?
            `,
            args: [
              name,
              row.barcode || "",
              categoryId,
              toInt(row.price ?? row.harga),
              toInt(row.cost ?? row.modal),
              stockVal,
              toInt(row.min_stock ?? row.stok_minimum),
              row.unit || row.satuan || "pcs",
              active ? 1 : 0,
              productId,
              session.tenantId,
            ],
          });
          // Per-outlet stock upsert for existing product
          if (defaultOutletId) {
            statements.push({
              sql: `
                INSERT INTO product_stock (id, tenant_id, product_id, outlet_id, stock)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(tenant_id, product_id, outlet_id) DO UPDATE SET
                  stock = excluded.stock, updated_at = CURRENT_TIMESTAMP
              `,
              args: [await id("ps"), session.tenantId, productId, defaultOutletId, stockVal],
            });
          }
        } else {
          const newProductId = await id("prd");
          created += 1;
          statements.push({
            sql: `
              INSERT INTO products (
                id, tenant_id, name, sku, barcode, category_id, price, cost,
                stock, min_stock, unit, active
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
              newProductId,
              session.tenantId,
              name,
              sku,
              row.barcode || "",
              categoryId,
              toInt(row.price ?? row.harga),
              toInt(row.cost ?? row.modal),
              stockVal,
              toInt(row.min_stock ?? row.stok_minimum),
              row.unit || row.satuan || "pcs",
              active ? 1 : 0,
            ],
          });
          // Seed per-outlet stock for new product
          if (defaultOutletId && stockVal > 0) {
            statements.push({
              sql: `INSERT INTO product_stock (id, tenant_id, product_id, outlet_id, stock)
                    VALUES (?, ?, ?, ?, ?)`,
              args: [await id("ps"), session.tenantId, newProductId, defaultOutletId, stockVal],
            });
          }
        }
      }

      statements.push({
        sql: `
          INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
          VALUES (?, ?, ?, 'import.completed', 'Produk', ?)
        `,
        args: [
          await id("aud"),
          session.tenantId,
          session.name,
          `${data.filename} · ${created} dibuat · ${updated} diperbarui`,
        ],
      });

      try {
        if (statements.length) await db.batch(statements, "write");
      } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
          return {
            ok: false as const,
            message: "Ada SKU duplikat di toko ini. Gunakan SKU unik per toko.",
          };
        }
        throw error;
      }

      return { ok: true as const, created, updated, message: "Import produk selesai." };
    }

    // Find default outlet for per-outlet stock seeding
    const defaultOutlet = await db.execute({
      sql: "SELECT id FROM outlets WHERE tenant_id = ? AND active = 1 ORDER BY created_at ASC LIMIT 1",
      args: [session.tenantId],
    });
    const defaultOutletId = String(defaultOutlet.rows[0]?.id ?? "");

    let updated = 0;
    const statements = [];
    for (const row of rows) {
      const sku = row.sku;
      if (!sku) continue;
      const productResult = await db.execute({
        sql: "SELECT id, name, stock FROM products WHERE tenant_id = ? AND sku = ? LIMIT 1",
        args: [session.tenantId, sku],
      });
      const product = productResult.rows[0] as unknown as
        | { id: string; name: string; stock: number }
        | undefined;
      if (!product) continue;
      const stock = toInt(row.stock ?? row.stok);
      updated += 1;
      if (defaultOutletId) {
        // Per-outlet stock upsert for default outlet
        statements.push(
          {
            sql: `
              INSERT INTO product_stock (id, tenant_id, product_id, outlet_id, stock)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(tenant_id, product_id, outlet_id) DO UPDATE SET
                stock = excluded.stock, updated_at = CURRENT_TIMESTAMP
            `,
            args: [await id("ps"), session.tenantId, product.id, defaultOutletId, stock],
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
            args: [session.tenantId, product.id, product.id, session.tenantId],
          },
        );
      } else {
        // Fallback: direct update if no outlet exists
        statements.push({
          sql: `
            UPDATE products
            SET stock = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND tenant_id = ?
          `,
          args: [stock, product.id, session.tenantId],
        });
      }
      statements.push({
        sql: `
          INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
          VALUES (?, ?, ?, 'stock.adjusted', ?, ?)
        `,
        args: [
          await id("aud"),
          session.tenantId,
          session.name,
          product.name,
          `Import stok ${Number(product.stock)} → ${stock}${row.note ? ` · ${row.note}` : ""}`,
        ],
      });
    }

    statements.push({
      sql: `
        INSERT INTO audit_logs (id, tenant_id, user_name, action, target, detail)
        VALUES (?, ?, ?, 'import.completed', 'Stok', ?)
      `,
      args: [
        await id("aud"),
        session.tenantId,
        session.name,
        `${data.filename} · ${updated} produk`,
      ],
    });
    await db.batch(statements, "write");

    return { ok: true as const, updated, message: "Import stok selesai." };
  });

export const getNotifications = createServerFn({ method: "GET" })
  .validator(
    z
      .object({
        type: z.string().optional(),
        unreadOnly: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    const filters: string[] = ["tenant_id = ?"];
    const args: (string | number)[] = [session.tenantId];
    if (data?.type && data.type !== "all") {
      filters.push("type = ?");
      args.push(data.type);
    }
    if (data?.unreadOnly) {
      filters.push("is_read = 0");
    }
    const limit = data?.limit ?? 50;
    const offset = data?.offset ?? 0;
    const where = filters.join(" AND ");
    const result = await getTursoClient().execute({
      sql: `
        SELECT id, title, description, severity, type, is_read, created_at
        FROM notifications
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
      args: [...args, limit, offset],
    });
    return result.rows.map(
      (row) =>
        row as unknown as {
          id: string;
          title: string;
          description: string;
          severity: string;
          type: string;
          is_read: number;
          created_at: string;
        },
    );
  });

export const createNotification = createServerFn({ method: "POST" })
  .validator(
    z.object({
      type: z.string().trim().min(1).max(60),
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(1000).default(""),
      severity: z.enum(["info", "success", "warning", "error"]).default("info"),
      settingKey: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();

    // Gate by tenant notification setting
    if (data.settingKey) {
      const settingsResult = await getTursoClient().execute({
        sql: "SELECT value FROM tenant_settings WHERE tenant_id = ? AND key = ? LIMIT 1",
        args: [session.tenantId, data.settingKey],
      });
      const val = String(settingsResult.rows[0]?.value ?? "1");
      if (val === "0") return { ok: false as const, id: "" };
    }

    const notifId = await id("notif");
    await getTursoClient().execute({
      sql: `
        INSERT INTO notifications (id, tenant_id, title, description, severity, type, is_read)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `,
      args: [notifId, session.tenantId, data.title, data.description, data.severity, data.type],
    });

    await emitEvent(session.tenantId, {
      type: "notification.created",
      data: {
        id: notifId,
        title: data.title,
        severity: data.severity,
        type: data.type,
      },
      timestamp: Date.now(),
    });

    return { ok: true as const, id: notifId };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    await getTursoClient().execute({
      sql: "UPDATE notifications SET is_read = 1 WHERE id = ? AND tenant_id = ?",
      args: [data.id, session.tenantId],
    });
    return { ok: true as const };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  await getTursoClient().execute({
    sql: "UPDATE notifications SET is_read = 1 WHERE tenant_id = ? AND is_read = 0",
    args: [session.tenantId],
  });
  return { ok: true as const };
});

export const getUnreadNotificationCount = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: "SELECT COUNT(*) AS count FROM notifications WHERE tenant_id = ? AND is_read = 0",
    args: [session.tenantId],
  });
  return { count: Number(result.rows[0]?.count ?? 0) };
});

export const getDevices = createServerFn({ method: "GET" }).handler(async () => {
  const { requireRole } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireRole(["owner", "manager"]);
  const result = await getTursoClient().execute({
    sql: `
      SELECT id, name, kind, user_name, status, last_seen
      FROM devices
      WHERE tenant_id = ?
      ORDER BY updated_at DESC
    `,
    args: [session.tenantId],
  });
  return result.rows.map(
    (row) =>
      row as unknown as {
        id: string;
        name: string;
        kind: string;
        user_name: string;
        status: string;
        last_seen: string | null;
      },
  );
});

export const createDevicePairing = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(2).max(120),
      kind: z.enum(["cashier", "display", "printer", "mobile"]),
    }),
  )
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner", "manager"]);
    const deviceId = await id("dev");
    await getTursoClient().execute({
      sql: `
        INSERT INTO devices (id, tenant_id, name, kind, user_name, status, last_seen)
        VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
      `,
      args: [deviceId, session.tenantId, data.name.trim(), data.kind, session.name],
    });
    return { ok: true as const, id: deviceId, code: deviceId.slice(-6).toUpperCase() };
  });

export const logoutDevice = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const { requireRole } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireRole(["owner", "manager"]);
    const result = await getTursoClient().execute({
      sql: `
        UPDATE devices
        SET status = 'offline', user_name = '', last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `,
      args: [data.id, session.tenantId],
    });
    return { ok: Number(result.rowsAffected) > 0 };
  });

export const getPromotions = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
      SELECT id, name, description, active
      FROM promotions
      WHERE tenant_id = ?
      ORDER BY created_at DESC
    `,
    args: [session.tenantId],
  });
  return result.rows.map((row) => {
    const promotion = row as unknown as {
      id: string;
      name: string;
      description: string;
      active: number;
    };
    return { ...promotion, active: promotion.active === 1 };
  });
});

export const createPromotion = createServerFn({ method: "POST" })
  .validator(
    z.object({
      name: z.string().trim().min(2).max(160),
      description: z.string().trim().max(240).default(""),
      active: z.boolean().default(true),
    }),
  )
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    const promotionId = await id("prm");
    await getTursoClient().execute({
      sql: `
        INSERT INTO promotions (id, tenant_id, name, description, active)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: [
        promotionId,
        session.tenantId,
        data.name.trim(),
        data.description.trim(),
        data.active ? 1 : 0,
      ],
    });
    return { ok: true as const, id: promotionId };
  });

export const updatePromotion = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(2).max(160),
      description: z.string().trim().max(240).default(""),
      active: z.boolean().default(true),
    }),
  )
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    const result = await getTursoClient().execute({
      sql: `
        UPDATE promotions
        SET name = ?, description = ?, active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND tenant_id = ?
      `,
      args: [
        data.name.trim(),
        data.description.trim(),
        data.active ? 1 : 0,
        data.id,
        session.tenantId,
      ],
    });
    return { ok: Number(result.rowsAffected) > 0 };
  });

export const deletePromotion = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const { requireAuthSession } = await import("./auth");
    const { getTursoClient } = await import("./db/turso.server");
    const session = await requireAuthSession();
    await getTursoClient().execute({
      sql: "DELETE FROM promotions WHERE id = ? AND tenant_id = ?",
      args: [data.id, session.tenantId],
    });
    return { ok: true as const };
  });

export const getLowStockProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const db = getTursoClient();

  // Get products at or below min_stock
  const productResult = await db.execute({
    sql: `
      SELECT p.id, p.name, p.sku, p.barcode, p.stock, p.min_stock, p.unit, p.cost,
             s.name AS supplier_name, s.id AS supplier_id
      FROM products p
      LEFT JOIN suppliers s ON s.tenant_id = p.tenant_id AND s.id = (
        SELECT supplier_id FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.purchase_order_id AND po.tenant_id = poi.tenant_id
        WHERE poi.product_id = p.id AND po.tenant_id = p.tenant_id
        ORDER BY po.created_at DESC LIMIT 1
      )
      WHERE p.tenant_id = ? AND p.active = 1 AND p.stock <= p.min_stock
      ORDER BY (p.stock - p.min_stock) ASC
    `,
    args: [session.tenantId],
  });

  // Calculate 30-day sales velocity per product (by name match)
  const velocityResult = await db.execute({
    sql: `
      SELECT ti.name AS product_name,
             SUM(ti.qty) AS total_sold,
             COUNT(DISTINCT DATE(t.created_at)) AS days_with_sales
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id AND t.tenant_id = ti.tenant_id
      WHERE ti.tenant_id = ? AND t.status = 'completed'
        AND t.created_at >= datetime('now', '-30 days')
      GROUP BY ti.name
    `,
    args: [session.tenantId],
  });

  const velocityMap = new Map<string, number>();
  for (const row of velocityResult.rows) {
    const name = String(row.product_name);
    const totalSold = Number(row.total_sold);
    const days = Math.max(1, Number(row.days_with_sales));
    velocityMap.set(name, totalSold / days);
  }

  return productResult.rows.map((row) => {
    const product = row as unknown as {
      id: string;
      name: string;
      sku: string;
      barcode: string;
      stock: number;
      min_stock: number;
      unit: string;
      cost: number;
      supplier_name: string | null;
      supplier_id: string | null;
    };
    const avgDailySales = velocityMap.get(product.name) ?? 0;
    const leadTimeDays = 7;
    const suggestedQty =
      avgDailySales > 0
        ? Math.ceil(avgDailySales * leadTimeDays + product.min_stock - product.stock)
        : product.min_stock * 2;

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      stock: product.stock,
      minStock: product.min_stock,
      unit: product.unit,
      cost: product.cost,
      supplierName: product.supplier_name,
      supplierId: product.supplier_id,
      avgDailySales: Math.round(avgDailySales * 100) / 100,
      suggestedReorderQty: Math.max(0, suggestedQty),
    };
  });
});

// --- Top Selling Products ---

export const getTopSellingProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
      SELECT ti.name, SUM(ti.qty) AS total_sold
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id AND t.tenant_id = ti.tenant_id
      WHERE ti.tenant_id = ? AND t.status = 'completed'
        AND t.created_at >= datetime('now', '-30 days')
      GROUP BY ti.name
      ORDER BY total_sold DESC
      LIMIT 5
    `,
    args: [session.tenantId],
  });
  return result.rows.map((row) => ({
    name: String(row.name),
    qty: Number(row.total_sold),
  }));
});

// --- Sales by Hour ---

export const getSalesByHour = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAuthSession } = await import("./auth");
  const { getTursoClient } = await import("./db/turso.server");
  const session = await requireAuthSession();
  const result = await getTursoClient().execute({
    sql: `
      SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour,
             COALESCE(SUM(total), 0) AS sales,
             COUNT(*) AS transactions
      FROM transactions
      WHERE tenant_id = ? AND status = 'completed'
        AND created_at >= datetime('now', '-7 days')
      GROUP BY hour
      ORDER BY hour ASC
    `,
    args: [session.tenantId],
  });

  // Fill in all 24 hours with 0 if missing
  const hourMap = new Map<number, { sales: number; transactions: number }>();
  for (const row of result.rows) {
    hourMap.set(Number(row.hour), {
      sales: Number(row.sales),
      transactions: Number(row.transactions),
    });
  }

  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    label: `${String(i).padStart(2, "0")}:00`,
    sales: hourMap.get(i)?.sales ?? 0,
    transactions: hourMap.get(i)?.transactions ?? 0,
  }));
});
