import { type Page, expect } from "@playwright/test";

let counter = 0;

/** Generate a unique ID for test isolation (email, names, etc.) */
export function uid(prefix = "test") {
  counter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${ts}-${rand}-${counter}`;
}

export const TEST_PASSWORD = "Test1234!";

/** Register a fresh tenant and wait for dashboard. Returns the credentials used. */
export async function register(
  page: Page,
  opts?: { storeName?: string; ownerName?: string; email?: string; password?: string },
) {
  const storeName = opts?.storeName ?? uid("store");
  const ownerName = opts?.ownerName ?? uid("owner");
  const email = opts?.email ?? `${uid("email")}@e2e.test`;
  const password = opts?.password ?? TEST_PASSWORD;

  await page.goto("/register");
  await page.waitForLoadState("networkidle");
  await page.waitForSelector('input[placeholder="Nama toko kamu"]', { state: "attached" });
  await page.getByPlaceholder("Nama toko kamu").fill(storeName);
  await page.getByPlaceholder("Nama kamu").fill(ownerName);
  await page.getByPlaceholder("kamu@toko.id").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.waitForTimeout(1500);
  // Use evaluate to ensure the click handler fires reliably
  await page.evaluate(() => {
    const btn = document.querySelector("button");
    if (btn) btn.click();
  });

  // Wait for navigation to dashboard
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({ timeout: 15_000 });

  return { storeName, ownerName, email, password };
}

/** Login with email/password and wait for redirect. */
export async function login(page: Page, email: string, password: string, waitFor?: string) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.waitForSelector('input[name="email"]', { state: "attached" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Masuk" }).first().click();

  const target = waitFor ?? "**/dashboard";
  await page.waitForURL(`**${target}`, { timeout: 30_000 });
}

/** Create a category via the UI. Assumes user is authenticated and on categories page. */
export async function seedCategory(page: Page, name?: string) {
  const catName = name ?? uid("kategori");
  await page.goto("/categories");
  await page.getByRole("button", { name: "Tambah Kategori" }).click();
  await page.locator('input[name="name"]').fill(catName);
  await page.getByRole("button", { name: "Simpan" }).first().click();
  // Wait for toast or the category to appear
  await expect(page.getByText(catName)).toBeVisible({ timeout: 10_000 });
  return catName;
}

/** Create an outlet via the UI. Assumes user is authenticated. */
export async function seedOutlet(page: Page, name?: string) {
  const outletName = name ?? uid("outlet");
  await page.goto("/outlets");
  await page.getByRole("button", { name: "Tambah Outlet" }).click();
  await page.locator('input[name="name"]').fill(outletName);
  await page.getByRole("button", { name: "Simpan" }).first().click();
  await expect(page.getByText(outletName)).toBeVisible({ timeout: 10_000 });
  return outletName;
}

/** Create a product via the UI. Assumes categories exist. */
export async function seedProduct(
  page: Page,
  opts?: { name?: string; sku?: string; price?: number; stock?: number; category?: string },
) {
  const productName = opts?.name ?? uid("produk");
  const sku = opts?.sku ?? uid("SKU");
  const price = opts?.price ?? 15000;
  const stock = opts?.stock ?? 50;

  await page.goto("/products/new");

  // Fill basic info
  await page.locator('input[name="name"]').fill(productName);
  await page.locator('input[name="sku"]').fill(sku);

  // Select first category from dropdown
  const categorySelect = page.locator('select[name="categoryId"]');
  await categorySelect.waitFor({ state: "visible", timeout: 5_000 });
  await categorySelect.selectOption({ index: 1 }); // skip "Pilih kategori" placeholder

  await page.locator('input[name="unit"]').fill("pcs");

  // Fill pricing
  await page.locator('input[name="price"]').fill(String(price));
  await page.locator('input[name="stock"]').fill(String(stock));

  // Submit
  await page.getByRole("button", { name: "Simpan" }).click();
  await page.waitForURL("**/products", { timeout: 15_000 });
  await expect(page.getByText(productName)).toBeVisible({ timeout: 10_000 });

  return { productName, sku, price, stock };
}

/** Seed a full catalog (category + outlet + product) for cashier tests. */
export async function seedCatalog(page: Page) {
  const catName = await seedCategory(page);
  const outletName = await seedOutlet(page);
  const product = await seedProduct(page, { category: catName });
  return { catName, outletName, ...product };
}
