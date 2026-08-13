import { test, expect } from "@playwright/test"
import { TAURI_MOCK_SCRIPT } from "./fixtures/tauri-mock"

// The theme is driven by the native application menu, which is not reachable
// from a browser context — so these cover how the app resolves and persists it.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(TAURI_MOCK_SCRIPT)
})

test("follows a dark system preference on first launch", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")
  await expect(page.locator("html")).toHaveClass(/dark/)
})

test("follows a light system preference on first launch", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/")
  await expect(page.locator("html")).not.toHaveClass(/dark/)
})

test("a stored dark preference wins over a light system preference", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"))
  await page.emulateMedia({ colorScheme: "light" })
  await page.goto("/")
  await expect(page.locator("html")).toHaveClass(/dark/)
})

test("a stored light preference wins over a dark system preference", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"))
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")
  await expect(page.locator("html")).not.toHaveClass(/dark/)
})

test("persists the resolved theme for the next launch", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/")
  await expect(page.locator("html")).toHaveClass(/dark/)
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark")
})
