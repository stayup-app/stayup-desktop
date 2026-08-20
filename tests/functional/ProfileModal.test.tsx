import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ProfileModal } from "@/components/profile/ProfileModal"
import { LanguageProvider } from "@/context/LanguageContext"
import type { AppSession } from "@/lib/session"

vi.mock("@/lib/api", () => ({ updateProfile: vi.fn() }))
vi.mock("@/lib/store", () => ({
  readToken: vi.fn().mockResolvedValue("token-1"),
  readApiUrl: vi.fn().mockResolvedValue("https://api.test"),
  readLang: vi.fn().mockResolvedValue(null),
  writeLang: vi.fn().mockResolvedValue(undefined),
}))

const session: AppSession = {
  userId: "user-1",
  name: "Alice",
  email: "alice@test.com",
  role: "user",
}

function renderModal(open = true, onClose = vi.fn()) {
  render(
    <LanguageProvider>
      <ProfileModal open={open} onClose={onClose} session={session} />
    </LanguageProvider>,
  )
  return onClose
}

describe("ProfileModal", () => {
  it("renders nothing when closed", () => {
    renderModal(false)
    expect(screen.queryByText("Mon profil")).not.toBeInTheDocument()
  })

  it("shows the profile forms prefilled with the session email", () => {
    renderModal(true)
    expect(screen.getByText("Mon profil")).toBeInTheDocument()
    expect(screen.getByLabelText("Nouvelle adresse e-mail")).toHaveValue("alice@test.com")
    expect(screen.getByLabelText("Nouveau mot de passe")).toBeInTheDocument()
  })

  it("calls onClose when the close button is clicked", () => {
    const onClose = renderModal(true)
    fireEvent.click(screen.getByText("Fermer"))
    expect(onClose).toHaveBeenCalled()
  })

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = renderModal(true)
    const backdrop = document.querySelector(".bg-black\\/50")!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalled()
  })
})
