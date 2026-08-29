import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { LoginModal } from "@/components/auth/LoginModal"
import { OAuthButtons } from "@/components/auth/OAuthButtons"
import { LanguageProvider } from "@/context/LanguageContext"
import { fr } from "@/lib/translations/fr"
import { fetchAuthConfig } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchAuthConfig: vi.fn(),
}))

const config = (over: Partial<import("@/lib/api").AuthConfig> = {}) => ({
  registrationMode: "open" as const,
  emailPassword: true,
  oauth: { github: true, google: true },
  ...over,
})

beforeEach(() => {
  vi.mocked(fetchAuthConfig).mockResolvedValue(config())
})

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

    expect(screen.getByText(fr.auth.loginTitle)).toBeInTheDocument()
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

  it("reveals the server field, defaulting to the current API host", async () => {
    renderWithLang(
      <LoginModal
        onLogin={vi.fn()}
        onRegister={vi.fn()}
        onOAuth={vi.fn()}
        loading={false}
        error={null}
      />,
    )

    // The disclosure shows the host of the default API up front.
    const toggle = await screen.findByRole("button", {
      name: new RegExp(`${fr.auth.server}.*stayup-api`),
    })
    fireEvent.click(toggle)

    expect(await screen.findByLabelText(fr.profile.apiUrl)).toBeInTheDocument()
  })

  it("hides an OAuth provider the instance does not offer", async () => {
    vi.mocked(fetchAuthConfig).mockResolvedValue(config({ oauth: { github: true, google: false } }))
    renderWithLang(
      <LoginModal
        onLogin={vi.fn()}
        onRegister={vi.fn()}
        onOAuth={vi.fn()}
        loading={false}
        error={null}
      />,
    )

    expect(await screen.findByText(fr.auth.continueWithGitHub)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText(fr.auth.continueWithGoogle)).not.toBeInTheDocument(),
    )
  })

  it("drops the OAuth block entirely when the instance offers neither", async () => {
    vi.mocked(fetchAuthConfig).mockResolvedValue(
      config({ oauth: { github: false, google: false } }),
    )
    renderWithLang(
      <LoginModal
        onLogin={vi.fn()}
        onRegister={vi.fn()}
        onOAuth={vi.fn()}
        loading={false}
        error={null}
      />,
    )

    await waitFor(() => expect(screen.queryByText(fr.auth.or)).not.toBeInTheDocument())
  })

  it("warns about admin approval on the register form when the instance requires it", async () => {
    vi.mocked(fetchAuthConfig).mockResolvedValue(config({ registrationMode: "approval" }))
    renderWithLang(
      <LoginModal
        onLogin={vi.fn()}
        onRegister={vi.fn()}
        onOAuth={vi.fn()}
        loading={false}
        error={null}
      />,
    )

    // Not shown on the login tab…
    await waitFor(() => expect(fetchAuthConfig).toHaveBeenCalled())
    expect(screen.queryByText(fr.auth.pendingApprovalHint)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(fr.auth.signUp))
    expect(await screen.findByText(fr.auth.pendingApprovalHint)).toBeInTheDocument()
  })

  it("falls back to offering everything when the API has no /auth/config", async () => {
    vi.mocked(fetchAuthConfig).mockResolvedValue(null)
    renderWithLang(
      <LoginModal
        onLogin={vi.fn()}
        onRegister={vi.fn()}
        onOAuth={vi.fn()}
        loading={false}
        error={null}
      />,
    )

    expect(await screen.findByText(fr.auth.continueWithGitHub)).toBeInTheDocument()
    expect(screen.getByText(fr.auth.continueWithGoogle)).toBeInTheDocument()
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

  it("renders only the providers it is told to", () => {
    renderWithLang(
      <OAuthButtons
        onOAuth={vi.fn()}
        loading={false}
        providers={{ github: false, google: true }}
      />,
    )
    expect(screen.queryByText(fr.auth.continueWithGitHub)).not.toBeInTheDocument()
    expect(screen.getByText(fr.auth.continueWithGoogle)).toBeInTheDocument()
  })

  it("renders nothing when no provider is offered", () => {
    const { container } = renderWithLang(
      <OAuthButtons
        onOAuth={vi.fn()}
        loading={false}
        providers={{ github: false, google: false }}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("applies and reverts the hover styling", () => {
    renderWithLang(<OAuthButtons onOAuth={vi.fn()} loading={false} />)
    const button = screen.getByText(fr.auth.continueWithGitHub).closest("button")!

    fireEvent.mouseEnter(button)
    expect(button.style.background).toBe("var(--surface-hi)")

    fireEvent.mouseLeave(button)
    expect(button.style.background).toBe("var(--surface)")
  })
})
