import { test, expect } from "@playwright/test";
import { register, login, uid, TEST_PASSWORD } from "./helpers";

test.describe("Navigation", () => {
  test("sidebar shows correct items for owner", async ({ page }) => {
    await register(page);

    // Verify sidebar groups are visible
    await expect(page.getByText("Utama")).toBeVisible();
    await expect(page.getByText("Katalog")).toBeVisible();
    await expect(page.getByText("Pembelian")).toBeVisible();
    await expect(page.getByText("Penjualan")).toBeVisible();
    await expect(page.getByText("Operasional")).toBeVisible();

    // Verify key nav items
    await expect(page.getByRole("link", { name: /Dashboard/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Produk/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Kategori/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Stok/ })).toBeVisible();
  });

  test("owner can access all main routes", async ({ page }) => {
    await register(page);

    const routes = [
      "/dashboard",
      "/products",
      "/categories",
      "/inventory",
      "/suppliers",
      "/purchase-orders",
      "/customers",
      "/expenses",
      "/outlets",
      "/users",
      "/audit-logs",
      "/settings",
    ];

    for (const route of routes) {
      await page.goto(route);
      // Should NOT redirect to login — stay on the route
      expect(page.url()).not.toContain("/login");
      // Page should load without error (no blank page)
      await expect(page.locator("body")).not.toBeEmpty();
    }
  });

  test("unauthenticated user redirected to login", async ({ page }) => {
    await page.context().clearCookies();

    const protectedRoutes = ["/dashboard", "/products", "/categories", "/settings"];
    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForURL("**/login", { timeout: 10_000 });
    }
  });

  test("logout prevents access to protected routes", async ({ page }) => {
    const creds = await register(page);
    await expect(page.getByText("Dashboard")).toBeVisible();

    // Logout
    await page.getByRole("button", { name: "Keluar" }).click();
    await page.waitForURL("**/login", { timeout: 10_000 });

    // Try protected routes
    await page.goto("/dashboard");
    await page.waitForURL("**/login", { timeout: 10_000 });

    await page.goto("/products");
    await page.waitForURL("**/login", { timeout: 10_000 });
  });

  test("login page has link to register", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /Daftar gratis/ })).toBeVisible();
  });

  test("login page has link to forgot password", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /Lupa/ })).toBeVisible();
  });
});
