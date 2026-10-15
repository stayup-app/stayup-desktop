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

type Props = Partial<React.ComponentProps<typeof UserMenu>>

function renderMenu(props: Props = {}) {
  return render(
    <LanguageProvider initialLang="fr">
      <UserMenu session={session} onLogout={() => {}} onOpenProfile={() => {}} {...props} />
    </LanguageProvider>,
  )
}

describe("UserMenu", () => {
  it("shows the avatar initial from the user's name, not the email", () => {
    renderMenu()
    expect(screen.getByText("A")).toBeInTheDocument()
    expect(screen.queryByText("alice@test.com")).not.toBeInTheDocument()
  })

  it("keeps the menu closed until the avatar is clicked", () => {
    renderMenu()
    expect(screen.queryByText(fr.userMenu.profile)).not.toBeInTheDocument()

    fireEvent.click(screen.getByTitle("Alice"))
    expect(screen.getByText(fr.userMenu.profile)).toBeInTheDocument()
  })

  it("calls onOpenProfile and closes when Profil is clicked", () => {
    const onOpenProfile = vi.fn()
    renderMenu({ onOpenProfile })

    fireEvent.click(screen.getByTitle("Alice"))
    fireEvent.click(screen.getByText(fr.userMenu.profile))

    expect(onOpenProfile).toHaveBeenCalled()
    expect(screen.queryByText(fr.userMenu.profile)).not.toBeInTheDocument()
  })

  it("calls onLogout when sign-out is clicked", () => {
    const onLogout = vi.fn()
    renderMenu({ onLogout })

    fireEvent.click(screen.getByTitle("Alice"))
    fireEvent.click(screen.getByText(fr.userMenu.signOut))

    expect(onLogout).toHaveBeenCalled()
  })

  it("tints the sign-out row on hover and restores it on leave", () => {
    renderMenu()
    fireEvent.click(screen.getByTitle("Alice"))
    const signOut = screen.getByText(fr.userMenu.signOut).closest("button")!

    fireEvent.mouseEnter(signOut)
    expect(signOut.style.color).toBe("var(--rose)")
    expect(signOut.style.background).toBe("var(--rose-dim)")

    fireEvent.mouseLeave(signOut)
    expect(signOut.style.color).toBe("var(--fg-soft)")
    expect(signOut.style.background).toBe("transparent")
  })

  it("stays open on a mousedown inside the menu", () => {
    renderMenu()
    fireEvent.click(screen.getByTitle("Alice"))

    fireEvent.mouseDown(screen.getByText(fr.userMenu.profile))

    expect(screen.getByText(fr.userMenu.profile)).toBeInTheDocument()
  })

  it("closes when clicking outside", () => {
    render(
      <LanguageProvider initialLang="fr">
        <div>
          <UserMenu session={session} onLogout={() => {}} onOpenProfile={() => {}} />
          <button>outside</button>
        </div>
      </LanguageProvider>,
    )

    fireEvent.click(screen.getByTitle("Alice"))
    expect(screen.getByText(fr.userMenu.profile)).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByText("outside"))
    expect(screen.queryByText(fr.userMenu.profile)).not.toBeInTheDocument()
  })
})
