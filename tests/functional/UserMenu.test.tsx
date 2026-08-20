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
  return render(<LanguageProvider initialLang="fr">{ui}</LanguageProvider>)
}

describe("UserMenu", () => {
  it("shows the signed-in email", () => {
    renderWithLang(<UserMenu session={session} onLogout={() => {}} onOpenProfile={() => {}} />)
    expect(screen.getByText("alice@test.com")).toBeInTheDocument()
  })

  it("calls onLogout when the sign-out button is clicked", () => {
    const onLogout = vi.fn()
    renderWithLang(<UserMenu session={session} onLogout={onLogout} onOpenProfile={() => {}} />)
    fireEvent.click(screen.getByText(fr.userMenu.signOut))
    expect(onLogout).toHaveBeenCalled()
  })

  it("calls onOpenProfile when the email is clicked", () => {
    const onOpenProfile = vi.fn()
    renderWithLang(<UserMenu session={session} onLogout={() => {}} onOpenProfile={onOpenProfile} />)
    fireEvent.click(screen.getByText("alice@test.com"))
    expect(onOpenProfile).toHaveBeenCalled()
  })

  it("embeds the language switcher", () => {
    renderWithLang(<UserMenu session={session} onLogout={() => {}} onOpenProfile={() => {}} />)
    expect(screen.getByLabelText("Language")).toBeInTheDocument()
  })
})

describe("LanguageSwitcher", () => {
  it("shows the active language as the selected option", () => {
    renderWithLang(<LanguageSwitcher />)
    expect(screen.getByLabelText("Language")).toHaveValue("fr")
  })

  it("switches the app to English", async () => {
    renderWithLang(
      <>
        <LanguageSwitcher />
        <UserMenu session={session} onLogout={() => {}} onOpenProfile={() => {}} />
      </>,
    )

    fireEvent.change(screen.getAllByLabelText("Language")[0], { target: { value: "en" } })

    await waitFor(() => expect(screen.getByText(en.userMenu.signOut)).toBeInTheDocument())
  })

  it("switches back to French", async () => {
    renderWithLang(
      <>
        <LanguageSwitcher />
        <UserMenu session={session} onLogout={() => {}} onOpenProfile={() => {}} />
      </>,
    )

    fireEvent.change(screen.getAllByLabelText("Language")[0], { target: { value: "en" } })
    await waitFor(() => expect(screen.getByText(en.userMenu.signOut)).toBeInTheDocument())

    fireEvent.change(screen.getAllByLabelText("Language")[0], { target: { value: "fr" } })
    await waitFor(() => expect(screen.getByText(fr.userMenu.signOut)).toBeInTheDocument())
  })

  it("offers every supported language", () => {
    renderWithLang(<LanguageSwitcher />)
    const select = screen.getByLabelText("Language") as HTMLSelectElement
    const values = Array.from(select.options).map((o) => o.value)
    expect(values).toEqual(["en", "fr", "de", "es", "it", "pt", "ja", "zh"])
  })
})
