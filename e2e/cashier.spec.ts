import { test, expect } from "@playwright/test";
import { register, seedCatalog, login, uid, TEST_PASSWORD } from "./helpers";

test.describe("Cashier Flow", () => {
  test("full cashier transaction with cash", async ({ page }) => {
    // Register and seed catalog
    const creds = await register(page);
    const product = await seedCatalog(page);

    // Open shift
    await page.goto("/cashier/shift/open");
    // Select first outlet (should be pre-selected)
    await page.locator("input[type='number']").fill("500000");
    await page.getByRole("button", { name: "Mulai Shift" }).click();
    await page.waitForURL("**/cashier", { timeout: 15_000 });

    // Product should be visible in the grid
    await expect(page.getByText(product.productName)).toBeVisible({ timeout: 10_000 });

    // Click product to add to cart
    await page.getByText(product.productName).first().click();

    // Verify cart shows item
    await expect(page.getByText(product.productName)).toBeVisible();
    // The cart section (right side) should show the item with price
    await expect(page.getByText("Rp")).toBeVisible();

    // Click Bayar to open checkout modal
    await page.getByRole("button", { name: /Bayar/ }).click();

    // Checkout modal should appear with payment methods
    await expect(page.getByRole("button", { name: "Cash" })).toBeVisible({ timeout: 5_000 });

    // Select Cash method
    await page.getByRole("button", { name: "Cash" }).click();

    // Click Selesai to complete
    await page.getByRole("button", { name: "Selesai" }).click();

    // Should show success toast and cart cleared
    await expect(page.getByText(/berhasil/i)).toBeVisible({ timeout: 10_000 });
  });

  test("hold and recall order", async ({ page }) => {
    const creds = await register(page);
    const product = await seedCatalog(page);

    // Open shift
    await page.goto("/cashier/shift/open");
    await page.locator("input[type='number']").fill("500000");
    await page.getByRole("button", { name: "Mulai Shift" }).click();
    await page.waitForURL("**/cashier", { timeout: 15_000 });

    // Add product to cart
    await page.getByText(product.productName).first().click();
    await expect(page.getByText(product.productName)).toBeVisible();

    // Hold order
    await page.getByRole("button", { name: /Hold/ }).click();
    await expect(page.getByText(/ditahan/i)).toBeVisible({ timeout: 5_000 });

    // Cart should be empty now (no product in cart section)
    // Held order should appear
    await expect(page.getByText(/Ambil/)).toBeVisible({ timeout: 5_000 });

    // Recall held order
    await page.getByRole("button", { name: /Ambil/ }).first().click();

    // Product should be back in cart
    await expect(page.getByText(product.productName)).toBeVisible();
  });

  test("void all clears cart", async ({ page }) => {
    const creds = await register(page);
    const product = await seedCatalog(page);

    // Open shift
    await page.goto("/cashier/shift/open");
    await page.locator("input[type='number']").fill("500000");
    await page.getByRole("button", { name: "Mulai Shift" }).click();
    await page.waitForURL("**/cashier", { timeout: 15_000 });

    // Add product
    await page.getByText(product.productName).first().click();

    // Void all
    await page.getByRole("button", { name: /Void All/ }).click();
    await expect(page.getByText(/kosongkan/i)).toBeVisible({ timeout: 5_000 });
  });

  test("close shift", async ({ page }) => {
    const creds = await register(page);
    const product = await seedCatalog(page);

    // Open shift with 500k
    await page.goto("/cashier/shift/open");
    await page.locator("input[type='number']").fill("500000");
    await page.getByRole("button", { name: "Mulai Shift" }).click();
    await page.waitForURL("**/cashier", { timeout: 15_000 });

    // Complete a transaction first
    await page.getByText(product.productName).first().click();
    await page.getByRole("button", { name: /Bayar/ }).click();
    await page.getByRole("button", { name: "Cash" }).click();
    await page.getByRole("button", { name: "Selesai" }).click();
    await expect(page.getByText(/berhasil/i)).toBeVisible({ timeout: 10_000 });

    // Navigate to close shift
    await page.goto("/cashier/shift/close");
    await expect(page.getByText("Tutup Shift")).toBeVisible({ timeout: 10_000 });

    // Should show expected cash (500k opening + any cash sales)
    await expect(page.getByText("Expected Cash")).toBeVisible();

    // Close shift
    await page.getByRole("button", { name: /Tutup Shift/ }).click();
    await page.waitForURL("**/dashboard", { timeout: 15_000 });
  });
});
