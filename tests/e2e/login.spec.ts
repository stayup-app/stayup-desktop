import { test, expect } from "@playwright/test"
import { TAURI_MOCK_SCRIPT } from "./fixtures/tauri-mock"

test.beforeEach(async ({ page }) => {
  await page.addInitScript(TAURI_MOCK_SCRIPT)
})

test("shows the login modal on first launch", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Bon retour" })).toBeVisible()
  await expect(page.getByText("Connectez-vous pour accéder à vos flux")).toBeVisible()
})

test("renders email and password fields in the login form", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Mot de passe")).toBeVisible()
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible()
})

test("offers the OAuth sign-in options", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("button", { name: "Continuer avec GitHub" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Continuer avec Google" })).toBeVisible()
})

test("shows validation errors when submitting an empty form", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Se connecter" }).click()
  await expect(page.getByText("Email invalide")).toBeVisible()
  await expect(page.getByText("Mot de passe requis")).toBeVisible()
})

test("shows an error when the password is missing", async ({ page }) => {
  await page.goto("/")
  await page.getByLabel("Email").fill("user@test.com")
  await page.getByRole("button", { name: "Se connecter" }).click()
  await expect(page.getByText("Mot de passe requis")).toBeVisible()
  await expect(page.getByText("Email invalide")).toHaveCount(0)
})

test("the browser blocks submission of a malformed email", async ({ page }) => {
  // type="email" fails native constraint validation, so the form never submits
  // and react-hook-form is not reached.
  await page.goto("/")
  await page.getByLabel("Email").fill("not-an-email")
  await page.getByLabel("Mot de passe").fill("pass")
  await page.getByRole("button", { name: "Se connecter" }).click()

  await expect(page.getByText("Email invalide")).toHaveCount(0)
  await expect(page.getByLabel("Email")).toHaveJSProperty("validity.valid", false)
})

test("surfaces a server error when the credentials are rejected", async ({ page }) => {
  await page.route("**/auth/login", (route) => route.fulfill({ status: 401, body: "{}" }))

  await page.goto("/")
  await page.getByLabel("Email").fill("user@test.com")
  await page.getByLabel("Mot de passe").fill("wrong-password")
  await page.getByRole("button", { name: "Se connecter" }).click()

  await expect(page.getByText("Identifiants invalides.")).toBeVisible()
})
