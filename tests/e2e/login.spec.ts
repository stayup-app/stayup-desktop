import { test, expect } from "@playwright/test"
import { TAURI_MOCK_SCRIPT } from "./fixtures/tauri-mock"

test.beforeEach(async ({ page }) => {
  await page.addInitScript(TAURI_MOCK_SCRIPT)
})

test("shows the login modal on first launch", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Good to see you again." })).toBeVisible()
  await expect(page.getByText("Pick up right where you left off.")).toBeVisible()
})

test("renders email and password fields in the login form", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Password")).toBeVisible()
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible()
})

test("offers the OAuth sign-in options", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible()
})

test("shows validation errors when submitting an empty form", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByText("Invalid email")).toBeVisible()
  await expect(page.getByText("Password is required")).toBeVisible()
})

test("shows an error when the password is missing", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel("Email").fill("user@test.com")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByText("Password is required")).toBeVisible()
  await expect(page.getByText("Invalid email")).toHaveCount(0)
})

test("the browser blocks submission of a malformed email", async ({ page }) => {
  // type="email" fails native constraint validation, so the form never submits
  // and react-hook-form is not reached.
  await page.goto("/")
  await page.getByLabel("Email").fill("not-an-email")
  await page.getByLabel("Password").fill("pass")
  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(page.getByText("Invalid email")).toHaveCount(0)
  await expect(page.getByLabel("Email")).toHaveJSProperty("validity.valid", false)
})

test("surfaces a server error when the credentials are rejected", async ({ page }) => {
  await page.route("**/auth/login", (route) => route.fulfill({ status: 401, body: "{}" }))

  await page.goto("/")
  await page.getByLabel("Email").fill("user@test.com")
  await page.getByLabel("Password").fill("wrong-password")
  await page.getByRole("button", { name: "Sign in" }).click()

  await expect(page.getByText("Wrong e-mail or password.")).toBeVisible()
})
