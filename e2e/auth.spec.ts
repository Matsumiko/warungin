import { test, expect } from "@playwright/test";
import { register, login, uid, TEST_PASSWORD } from "./helpers";

test.describe("Authentication", () => {
  test("register creates tenant and lands on dashboard", async ({ page }) => {
    await register(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("login with email credentials", async ({ page }) => {
    const creds = await register(page);
    await page.context().clearCookies();
    await login(page, creds.email, creds.password);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("login with invalid credentials stays on login", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("nonexistent@test.com");
    await page.locator('input[type="password"]').fill("wrongpassword");
    await page.getByRole("button", { name: "Masuk" }).first().click();
    // Should stay on login page (not navigate to dashboard)
    await page.waitForTimeout(3000);
    expect(page.url()).toContain("/login");
  });

  test("login page has PIN mode toggle", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "PIN Kasir" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Daftar gratis/ })).toBeVisible();
  });

  test("logout redirects to login", async ({ page }) => {
    await register(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await page.getByRole("button", { name: "Keluar" }).click();
    await page.waitForURL("**/login", { timeout: 10_000 });
  });

  test("login page has link to register", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /Daftar gratis/ })).toBeVisible();
  });
});
