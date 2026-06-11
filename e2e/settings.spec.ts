import { test, expect } from "@playwright/test";
import { register, seedCatalog } from "./helpers";

test.describe("Settings", () => {
  test("settings page loads with all tabs", async ({ page }) => {
    await register(page);
    await page.goto("/settings");

    // Verify all tab buttons are visible
    await expect(page.getByRole("button", { name: "Toko" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pajak & Biaya" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Struk" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pembayaran" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Printer" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Notifikasi" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tampilan" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Keamanan" })).toBeVisible();
  });

  test("toggle PPN and verify in settings", async ({ page }) => {
    await register(page);
    await page.goto("/settings");

    // Click Pajak & Biaya tab
    await page.getByRole("button", { name: "Pajak & Biaya" }).click();

    // Toggle PPN on (checkbox with name="taxEnabled")
    const ppnToggle = page.locator('input[name="taxEnabled"]');
    if (!(await ppnToggle.isChecked())) {
      await ppnToggle.check();
    }

    // Set tax rate to 11%
    await page.locator('input[name="taxRate"]').fill("11");

    // Save
    await page.getByRole("button", { name: "Simpan Perubahan" }).click();
    await expect(page.getByText("Pengaturan disimpan")).toBeVisible({ timeout: 10_000 });

    // Reload and verify persistence
    await page.reload();
    await page.getByRole("button", { name: "Pajak & Biaya" }).click();
    await expect(page.locator('input[name="taxRate"]')).toHaveValue("11");
  });

  test("store name update persists", async ({ page }) => {
    const creds = await register(page);
    await page.goto("/settings");

    // Update store name
    const newName = "Toko Updated " + Date.now().toString(36);
    await page.locator('input[name="storeName"]').fill(newName);
    await page.getByRole("button", { name: "Simpan Perubahan" }).click();
    await expect(page.getByText("Pengaturan disimpan")).toBeVisible({ timeout: 10_000 });

    // Verify sidebar shows new name
    await expect(page.getByText(newName)).toBeVisible({ timeout: 5_000 });
  });

  test("payment methods tab shows toggles", async ({ page }) => {
    await register(page);
    await page.goto("/settings");

    await page.getByRole("button", { name: "Pembayaran" }).click();

    // Should show payment method toggles
    await expect(page.getByText("Cash")).toBeVisible();
    await expect(page.getByText("QRIS")).toBeVisible();
    await expect(page.getByText("Transfer Bank")).toBeVisible();
  });
});
