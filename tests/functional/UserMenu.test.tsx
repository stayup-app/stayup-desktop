import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { UserMenu } from "@/components/layout/UserMenu"
import { LanguageProvider } from "@/context/LanguageContext"
import { fr } from "@/lib/translations"
import type { AppSession } from "@/lib/session"

const session: AppSession = {
  userId: "u1",
  name: "Alice",
  email: "alice@test.com",
  role: "user",
}

function renderWithLang(ui: React.ReactElement) {
  return render(<LanguageProvider initialLang="fr">{ui}</LanguageProvider>)
}

describe("UserMenu", () => {
  it("shows the avatar initial from the user's name, not the email", () => {
    renderWithLang(<UserMenu session={session} onLogout={() => {}} onOpenProfile={() => {}} />)
    expect(screen.getByText("A")).toBeInTheDocument()
    expect(screen.queryByText("alice@test.com")).not.toBeInTheDocument()
  })

  it("keeps the menu closed until the avatar is clicked", () => {
    renderWithLang(<UserMenu session={session} onLogout={() => {}} onOpenProfile={() => {}} />)
    expect(screen.queryByText(fr.userMenu.profile)).not.toBeInTheDocument()

    fireEvent.click(screen.getByTitle("Alice"))
    expect(screen.getByText(fr.userMenu.profile)).toBeInTheDocument()
  })

  it("calls onOpenProfile and closes when Profil is clicked", () => {
    const onOpenProfile = vi.fn()
    renderWithLang(<UserMenu session={session} onLogout={() => {}} onOpenProfile={onOpenProfile} />)

    fireEvent.click(screen.getByTitle("Alice"))
    fireEvent.click(screen.getByText(fr.userMenu.profile))

    expect(onOpenProfile).toHaveBeenCalled()
    expect(screen.queryByText(fr.userMenu.profile)).not.toBeInTheDocument()
  })

  it("calls onLogout when sign-out is clicked", () => {
    const onLogout = vi.fn()
    renderWithLang(<UserMenu session={session} onLogout={onLogout} onOpenProfile={() => {}} />)

    fireEvent.click(screen.getByTitle("Alice"))
    fireEvent.click(screen.getByText(fr.userMenu.signOut))

    expect(onLogout).toHaveBeenCalled()
  })

  it("closes when clicking outside", () => {
    renderWithLang(
      <div>
        <UserMenu session={session} onLogout={() => {}} onOpenProfile={() => {}} />
        <button>outside</button>
      </div>,
    )

    fireEvent.click(screen.getByTitle("Alice"))
    expect(screen.getByText(fr.userMenu.profile)).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByText("outside"))
    expect(screen.queryByText(fr.userMenu.profile)).not.toBeInTheDocument()
  })
})
