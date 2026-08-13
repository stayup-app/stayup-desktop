import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LoginModal } from "@/components/auth/LoginModal"
import { OAuthButtons } from "@/components/auth/OAuthButtons"
import { LanguageProvider } from "@/context/LanguageContext"
import { fr } from "@/lib/translations/fr"

function renderWithLang(ui: React.ReactElement) {
  return render(<LanguageProvider>{ui}</LanguageProvider>)
}

describe("LoginModal", () => {
  it("renders the branding, subtitle and both sign-in paths", () => {
    renderWithLang(<LoginModal onLogin={vi.fn()} onOAuth={vi.fn()} loading={false} error={null} />)

    expect(screen.getByText("StayUp")).toBeInTheDocument()
    expect(screen.getByText(fr.auth.subtitle)).toBeInTheDocument()
    expect(screen.getByText(fr.auth.or)).toBeInTheDocument()
    expect(screen.getByText(fr.auth.continueWithGitHub)).toBeInTheDocument()
    expect(screen.getByLabelText(fr.auth.email)).toBeInTheDocument()
  })

  it("forwards the error to the login form", () => {
    renderWithLang(
      <LoginModal onLogin={vi.fn()} onOAuth={vi.fn()} loading={false} error="Bad credentials" />,
    )
    expect(screen.getByText("Bad credentials")).toBeInTheDocument()
  })

  it("forwards the loading state to both sign-in paths", () => {
    renderWithLang(<LoginModal onLogin={vi.fn()} onOAuth={vi.fn()} loading error={null} />)

    expect(screen.getByText(fr.auth.signingIn)).toBeInTheDocument()
    expect(screen.getByText(fr.auth.continueWithGitHub).closest("button")).toBeDisabled()
  })
})

describe("OAuthButtons", () => {
  it("calls onOAuth with the GitHub provider", () => {
    const onOAuth = vi.fn()
    renderWithLang(<OAuthButtons onOAuth={onOAuth} loading={false} />)

    fireEvent.click(screen.getByText(fr.auth.continueWithGitHub))
    expect(onOAuth).toHaveBeenCalledWith("github")
  })

  it("calls onOAuth with the Google provider", () => {
    const onOAuth = vi.fn()
    renderWithLang(<OAuthButtons onOAuth={onOAuth} loading={false} />)

    fireEvent.click(screen.getByText(fr.auth.continueWithGoogle))
    expect(onOAuth).toHaveBeenCalledWith("google")
  })

  it("disables both buttons while loading", () => {
    renderWithLang(<OAuthButtons onOAuth={vi.fn()} loading />)

    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled()
    }
  })

  it("applies and reverts the hover styling", () => {
    renderWithLang(<OAuthButtons onOAuth={vi.fn()} loading={false} />)
    const button = screen.getByText(fr.auth.continueWithGitHub).closest("button")!

    fireEvent.mouseEnter(button)
    expect(button.style.background).toBe("var(--surface-3)")

    fireEvent.mouseLeave(button)
    expect(button.style.background).toBe("var(--surface-2)")
  })
})
