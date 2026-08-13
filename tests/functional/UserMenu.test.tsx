import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { UserMenu } from "@/components/layout/UserMenu"
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher"
import { LanguageProvider } from "@/context/LanguageContext"
import { fr, en } from "@/lib/translations"
import type { AppSession } from "@/lib/session"

const session: AppSession = {
  userId: "u1",
  name: "Alice",
  email: "alice@test.com",
  role: "user",
}

function renderWithLang(ui: React.ReactElement) {
  return render(<LanguageProvider>{ui}</LanguageProvider>)
}

describe("UserMenu", () => {
  it("shows the signed-in email", () => {
    renderWithLang(<UserMenu session={session} onLogout={() => {}} />)
    expect(screen.getByText("alice@test.com")).toBeInTheDocument()
  })

  it("calls onLogout when the sign-out button is clicked", () => {
    const onLogout = vi.fn()
    renderWithLang(<UserMenu session={session} onLogout={onLogout} />)
    fireEvent.click(screen.getByText(fr.userMenu.signOut))
    expect(onLogout).toHaveBeenCalled()
  })

  it("embeds the language switcher", () => {
    renderWithLang(<UserMenu session={session} onLogout={() => {}} />)
    expect(screen.getByLabelText("Français")).toBeInTheDocument()
    expect(screen.getByLabelText("English")).toBeInTheDocument()
  })
})

describe("LanguageSwitcher", () => {
  it("highlights the active language", () => {
    renderWithLang(<LanguageSwitcher />)
    expect(screen.getByLabelText("Français").className).toContain("text-foreground")
    expect(screen.getByLabelText("English").className).toContain("opacity-50")
  })

  it("switches the app to English", async () => {
    renderWithLang(
      <>
        <LanguageSwitcher />
        <UserMenu session={session} onLogout={() => {}} />
      </>,
    )

    fireEvent.click(screen.getAllByLabelText("English")[0])

    await waitFor(() => expect(screen.getByText(en.userMenu.signOut)).toBeInTheDocument())
  })

  it("switches back to French", async () => {
    renderWithLang(
      <>
        <LanguageSwitcher />
        <UserMenu session={session} onLogout={() => {}} />
      </>,
    )

    fireEvent.click(screen.getAllByLabelText("English")[0])
    await waitFor(() => expect(screen.getByText(en.userMenu.signOut)).toBeInTheDocument())

    fireEvent.click(screen.getAllByLabelText("Français")[0])
    await waitFor(() => expect(screen.getByText(fr.userMenu.signOut)).toBeInTheDocument())
  })
})
