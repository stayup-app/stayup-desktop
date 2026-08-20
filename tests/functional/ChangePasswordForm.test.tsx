import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm"
import { LanguageProvider } from "@/context/LanguageContext"
import { updateProfile } from "@/lib/api"
import { readToken, readApiUrl } from "@/lib/store"

vi.mock("@/lib/api", () => ({ updateProfile: vi.fn() }))
vi.mock("@/lib/store", () => ({
  readToken: vi.fn().mockResolvedValue("token-1"),
  readApiUrl: vi.fn().mockResolvedValue("https://api.test"),
  readLang: vi.fn().mockResolvedValue(null),
  writeLang: vi.fn().mockResolvedValue(undefined),
}))

function renderForm() {
  return render(
    <LanguageProvider initialLang="fr">
      <ChangePasswordForm userId="user-1" />
    </LanguageProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readToken).mockResolvedValue("token-1")
  vi.mocked(readApiUrl).mockResolvedValue("https://api.test")
  vi.mocked(updateProfile).mockResolvedValue(undefined)
})

describe("ChangePasswordForm", () => {
  it("submits the new password and shows a success message", async () => {
    renderForm()
    await userEvent.type(screen.getByLabelText("Nouveau mot de passe"), "newpassword1")
    await userEvent.type(screen.getByLabelText("Confirmer le nouveau mot de passe"), "newpassword1")
    fireEvent.submit(screen.getByRole("button", { name: "Changer le mot de passe" }))

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith("user-1", "token-1", "https://api.test", {
        password: "newpassword1",
      })
    })
    expect(await screen.findByText("Mot de passe modifié avec succès.")).toBeInTheDocument()
  })

  it("shows a validation error when passwords do not match", async () => {
    renderForm()
    await userEvent.type(screen.getByLabelText("Nouveau mot de passe"), "newpassword1")
    await userEvent.type(screen.getByLabelText("Confirmer le nouveau mot de passe"), "different1")
    fireEvent.submit(screen.getByRole("button", { name: "Changer le mot de passe" }))
    await screen.findByText("Les mots de passe ne correspondent pas")
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it("shows a validation error when the password is too short", async () => {
    renderForm()
    await userEvent.type(screen.getByLabelText("Nouveau mot de passe"), "short")
    await userEvent.type(screen.getByLabelText("Confirmer le nouveau mot de passe"), "short")
    fireEvent.submit(screen.getByRole("button", { name: "Changer le mot de passe" }))
    await screen.findByText("8 caractères minimum")
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it("surfaces the API error message", async () => {
    vi.mocked(updateProfile).mockRejectedValue(new Error("Erreur serveur."))
    renderForm()
    await userEvent.type(screen.getByLabelText("Nouveau mot de passe"), "newpassword1")
    await userEvent.type(screen.getByLabelText("Confirmer le nouveau mot de passe"), "newpassword1")
    fireEvent.submit(screen.getByRole("button", { name: "Changer le mot de passe" }))
    await screen.findByText("Erreur serveur.")
  })

  it("shows an error when the token is missing", async () => {
    vi.mocked(readToken).mockResolvedValue(null)
    renderForm()
    await userEvent.type(screen.getByLabelText("Nouveau mot de passe"), "newpassword1")
    await userEvent.type(screen.getByLabelText("Confirmer le nouveau mot de passe"), "newpassword1")
    fireEvent.submit(screen.getByRole("button", { name: "Changer le mot de passe" }))
    await screen.findByText("Token manquant")
    expect(updateProfile).not.toHaveBeenCalled()
  })
})
