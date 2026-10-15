import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ProfileModal } from "@/components/profile/ProfileModal"
import { LanguageProvider } from "@/context/LanguageContext"
import type { AppSession } from "@/lib/session"

vi.mock("@/lib/api", () => ({
  updateProfile: vi.fn(),
  ApiError: class extends Error {},
}))

const session: AppSession = {
  userId: "user-1",
  name: "Alice",
  email: "alice@test.com",
  role: "user",
}

function renderModal(open = true, onClose = vi.fn()) {
  render(
    <LanguageProvider initialLang="fr">
      <ProfileModal open={open} onClose={onClose} session={session} token="tok-1" />
    </LanguageProvider>,
  )
  return onClose
}

describe("ProfileModal", () => {
  it("renders nothing when closed", () => {
    renderModal(false)
    expect(screen.queryByText("Mon profil")).not.toBeInTheDocument()
  })

  it("shows the forms prefilled with the session email", () => {
    renderModal()
    expect(screen.getByText("Mon profil")).toBeInTheDocument()
    expect(screen.getByLabelText("Nouvelle adresse e-mail")).toHaveValue("alice@test.com")
    expect(screen.getByLabelText("Nouveau mot de passe")).toBeInTheDocument()
  })

  it("calls onClose from the button and the backdrop", () => {
    const onClose = renderModal()
    fireEvent.click(screen.getByText("Fermer"))
    fireEvent.click(screen.getByTestId("dialog-backdrop"))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
