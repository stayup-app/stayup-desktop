import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { LoginModal } from "@/components/auth/LoginModal"
import { OAuthButtons } from "@/components/auth/OAuthButtons"
import { LanguageProvider } from "@/context/LanguageContext"
import { fr } from "@/lib/translations/fr"

function renderWithLang(ui: React.ReactElement) {
  return render(<LanguageProvider initialLang="fr">{ui}</LanguageProvider>)
}

describe("LoginModal", () => {
  it("renders the branding, subtitle and both sign-in paths", () => {
    renderWithLang(
      <LoginModal
        onLogin={vi.fn()}
        onRegister={vi.fn()}
        onOAuth={vi.fn()}
        loading={false}
        error={null}
      />,
    )

    expect(screen.getByText("StayUp")).toBeInTheDocument()
    expect(screen.getByText(fr.auth.subtitle)).toBeInTheDocument()
    expect(screen.getByText(fr.auth.or)).toBeInTheDocument()
    expect(screen.getByText(fr.auth.continueWithGitHub)).toBeInTheDocument()
    expect(screen.getByLabelText(fr.auth.email)).toBeInTheDocument()
  })

  it("forwards the error to the login form", () => {
    renderWithLang(
      <LoginModal
        onLogin={vi.fn()}
        onRegister={vi.fn()}
        onOAuth={vi.fn()}
        loading={false}
        error="Bad credentials"
      />,
    )
    expect(screen.getByText("Bad credentials")).toBeInTheDocument()
  })

  it("forwards the loading state to both sign-in paths", () => {
    renderWithLang(
      <LoginModal onLogin={vi.fn()} onRegister={vi.fn()} onOAuth={vi.fn()} loading error={null} />,
    )

    expect(screen.getByText(fr.auth.signingIn)).toBeInTheDocument()
    expect(screen.getByText(fr.auth.continueWithGitHub).closest("button")).toBeDisabled()
  })

  it("switches to the register form and back", () => {
    renderWithLang(
      <LoginModal
        onLogin={vi.fn()}
        onRegister={vi.fn()}
        onOAuth={vi.fn()}
        loading={false}
        error={null}
      />,
    )

    fireEvent.click(screen.getByText(fr.auth.signUp))

    expect(screen.getByLabelText(fr.auth.name)).toBeInTheDocument()
    expect(screen.getByText(fr.auth.alreadyHaveAccount)).toBeInTheDocument()

    fireEvent.click(screen.getByText(fr.auth.signIn))

    expect(screen.queryByLabelText(fr.auth.name)).not.toBeInTheDocument()
  })

  it("submits the register form via onRegister", async () => {
    const onRegister = vi.fn()
    renderWithLang(
      <LoginModal
        onLogin={vi.fn()}
        onRegister={onRegister}
        onOAuth={vi.fn()}
        loading={false}
        error={null}
      />,
    )

    fireEvent.click(screen.getByText(fr.auth.signUp))
    fireEvent.change(screen.getByLabelText(fr.auth.name), { target: { value: "Alice" } })
    fireEvent.change(screen.getByLabelText(fr.auth.email), {
      target: { value: "alice@test.com" },
    })
    fireEvent.change(screen.getByLabelText(fr.auth.password), { target: { value: "password123" } })
    fireEvent.click(screen.getByRole("button", { name: fr.auth.signUp }))

    await waitFor(() => {
      expect(onRegister).toHaveBeenCalledWith("Alice", "alice@test.com", "password123")
    })
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
