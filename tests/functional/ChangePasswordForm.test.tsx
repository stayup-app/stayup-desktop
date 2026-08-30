import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm"
import { LanguageProvider } from "@/context/LanguageContext"
import { ApiError, updateProfile } from "@/lib/api"

// Le formulaire lit le statut porté par ApiError pour choisir le message traduit.
vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      readonly status: number,
      message: string,
    ) {
      super(message)
      this.name = "ApiError"
    }
  },
  updateProfile: vi.fn(),
}))

function renderForm(token = "token-1") {
  return render(
    <LanguageProvider initialLang="fr">
      <ChangePasswordForm userId="user-1" token={token} apiUrl="https://api.test" />
    </LanguageProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(updateProfile).mockResolvedValue(undefined)
})

describe("ChangePasswordForm", () => {
  it("submits the new password and shows a success message", async () => {
    renderForm()
    await userEvent.type(screen.getByLabelText("Mot de passe actuel"), "oldpassword1")
    await userEvent.type(screen.getByLabelText("Nouveau mot de passe"), "newpassword1")
    await userEvent.type(screen.getByLabelText("Confirmer le nouveau mot de passe"), "newpassword1")
    fireEvent.submit(screen.getByRole("button", { name: "Changer le mot de passe" }))

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith("user-1", "token-1", "https://api.test", {
        password: "newpassword1",
        currentPassword: "oldpassword1",
      })
    })
    expect(await screen.findByText("Mot de passe modifié avec succès.")).toBeInTheDocument()
  })

  it("shows a validation error when passwords do not match", async () => {
    renderForm()
    await userEvent.type(screen.getByLabelText("Mot de passe actuel"), "oldpassword1")
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

  it("translates a 401 into a wrong-current-password message", async () => {
    vi.mocked(updateProfile).mockRejectedValue(new ApiError(401, "Invalid credentials"))
    renderForm()
    await userEvent.type(screen.getByLabelText("Mot de passe actuel"), "oldpassword1")
    await userEvent.type(screen.getByLabelText("Nouveau mot de passe"), "newpassword1")
    await userEvent.type(screen.getByLabelText("Confirmer le nouveau mot de passe"), "newpassword1")
    fireEvent.submit(screen.getByRole("button", { name: "Changer le mot de passe" }))
    await screen.findByText("Ton mot de passe actuel n'est pas correct.")
  })

  // Sans mot de passe actuel, l'API refuserait : le formulaire s'arrête avant.
  it("refuses to submit without the current password", async () => {
    renderForm()
    await userEvent.type(screen.getByLabelText("Nouveau mot de passe"), "newpassword1")
    await userEvent.type(screen.getByLabelText("Confirmer le nouveau mot de passe"), "newpassword1")
    fireEvent.submit(screen.getByRole("button", { name: "Changer le mot de passe" }))
    await screen.findByText("Saisis ton mot de passe actuel")
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it("shows an error when the token is missing", async () => {
    renderForm("")
    await userEvent.type(screen.getByLabelText("Mot de passe actuel"), "oldpassword1")
    await userEvent.type(screen.getByLabelText("Nouveau mot de passe"), "newpassword1")
    await userEvent.type(screen.getByLabelText("Confirmer le nouveau mot de passe"), "newpassword1")
    fireEvent.submit(screen.getByRole("button", { name: "Changer le mot de passe" }))
    await screen.findByText("Token manquant")
    expect(updateProfile).not.toHaveBeenCalled()
  })
})
