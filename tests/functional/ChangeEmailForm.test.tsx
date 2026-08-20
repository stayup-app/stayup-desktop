import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ChangeEmailForm } from "@/components/profile/ChangeEmailForm"
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
      <ChangeEmailForm userId="user-1" currentEmail="alice@test.com" />
    </LanguageProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readToken).mockResolvedValue("token-1")
  vi.mocked(readApiUrl).mockResolvedValue("https://api.test")
  vi.mocked(updateProfile).mockResolvedValue(undefined)
})

describe("ChangeEmailForm", () => {
  it("prefills the current email", () => {
    renderForm()
    expect(screen.getByLabelText("Nouvelle adresse e-mail")).toHaveValue("alice@test.com")
  })

  it("submits the new email and shows a success message", async () => {
    renderForm()
    const input = screen.getByLabelText("Nouvelle adresse e-mail")
    await userEvent.clear(input)
    await userEvent.type(input, "new@test.com")
    fireEvent.submit(screen.getByRole("button", { name: "Mettre à jour l'e-mail" }))

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith("user-1", "token-1", "https://api.test", {
        email: "new@test.com",
      })
    })
    expect(await screen.findByText("Adresse e-mail mise à jour.")).toBeInTheDocument()
  })

  it("shows a validation error for an invalid email", async () => {
    renderForm()
    const input = screen.getByLabelText("Nouvelle adresse e-mail")
    await userEvent.clear(input)
    await userEvent.type(input, "not-an-email")
    fireEvent.submit(screen.getByRole("button", { name: "Mettre à jour l'e-mail" }))
    await screen.findByText("Email invalide")
    expect(updateProfile).not.toHaveBeenCalled()
  })

  it("surfaces the API error message", async () => {
    vi.mocked(updateProfile).mockRejectedValue(new Error("Erreur serveur."))
    renderForm()
    fireEvent.submit(screen.getByRole("button", { name: "Mettre à jour l'e-mail" }))
    await screen.findByText("Erreur serveur.")
  })

  it("shows an error when the token is missing", async () => {
    vi.mocked(readToken).mockResolvedValue(null)
    renderForm()
    fireEvent.submit(screen.getByRole("button", { name: "Mettre à jour l'e-mail" }))
    await screen.findByText("Token manquant")
    expect(updateProfile).not.toHaveBeenCalled()
  })
})
