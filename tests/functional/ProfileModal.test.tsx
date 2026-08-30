import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ProfileModal } from "@/components/profile/ProfileModal"
import { LanguageProvider } from "@/context/LanguageContext"
import { fr } from "@/lib/translations/fr"
import type { InstanceSession } from "@/hooks/useAuth"
import type { Instance } from "@/lib/store"

vi.mock("@/lib/api", () => ({
  updateProfile: vi.fn(),
  ApiError: class extends Error {},
}))

function session(over: Partial<InstanceSession> = {}): InstanceSession {
  return {
    userId: "user-1",
    name: "Alice",
    email: "alice@test.com",
    role: "user",
    instanceId: "i1",
    instanceName: "Primary",
    instanceUrl: "https://api.test",
    expired: false,
    ...over,
  }
}

const instances: Instance[] = [
  { id: "i1", url: "https://api.test", name: "Primary", token: "tok-1" },
  { id: "i2", url: "https://b.test", name: "Beta", token: "tok-2" },
]

function renderModal(sessions: InstanceSession[] = [session()], open = true, onClose = vi.fn()) {
  render(
    <LanguageProvider initialLang="fr">
      <ProfileModal open={open} onClose={onClose} sessions={sessions} instances={instances} />
    </LanguageProvider>,
  )
  return onClose
}

describe("ProfileModal", () => {
  it("renders nothing when closed", () => {
    renderModal([session()], false)
    expect(screen.queryByText("Mon profil")).not.toBeInTheDocument()
  })

  it("shows the forms prefilled with the primary session email", () => {
    renderModal()
    expect(screen.getByText("Mon profil")).toBeInTheDocument()
    expect(screen.getByLabelText("Nouvelle adresse e-mail")).toHaveValue("alice@test.com")
    expect(screen.getByLabelText("Nouveau mot de passe")).toBeInTheDocument()
  })

  it("hides the instance selector with a single session", () => {
    renderModal()
    expect(screen.queryByText(fr.instances.title)).not.toBeInTheDocument()
  })

  it("switches the forms to another instance's identity", () => {
    renderModal([
      session(),
      session({ instanceId: "i2", instanceName: "Beta", email: "bob@b.test", userId: "bob" }),
    ])
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "i2" } })
    expect(screen.getByLabelText("Nouvelle adresse e-mail")).toHaveValue("bob@b.test")
  })

  it("calls onClose from the button and the backdrop", () => {
    const onClose = renderModal()
    fireEvent.click(screen.getByText("Fermer"))
    fireEvent.click(screen.getByTestId("dialog-backdrop"))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
