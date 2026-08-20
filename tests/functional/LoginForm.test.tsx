import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LoginForm } from "@/components/auth/LoginForm"
import { LanguageProvider } from "@/context/LanguageContext"

function renderWithLang(ui: React.ReactElement) {
  return render(<LanguageProvider initialLang="fr">{ui}</LanguageProvider>)
}

describe("LoginForm", () => {
  it("renders email and password inputs", () => {
    renderWithLang(<LoginForm onSubmit={vi.fn()} loading={false} error={null} />)
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument()
  })

  it("calls onSubmit with credentials on valid submission", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    renderWithLang(<LoginForm onSubmit={onSubmit} loading={false} error={null} />)

    await userEvent.type(screen.getByLabelText("Email"), "user@test.com")
    await userEvent.type(screen.getByLabelText("Mot de passe"), "secret123")
    fireEvent.submit(screen.getByRole("button", { name: "Se connecter" }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("user@test.com", "secret123")
    })
  })

  it("shows a validation error for an invalid email", async () => {
    renderWithLang(<LoginForm onSubmit={vi.fn()} loading={false} error={null} />)
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email")
    fireEvent.submit(screen.getByRole("button", { name: "Se connecter" }))
    await screen.findByText("Email invalide")
  })

  it("shows a validation error when the password is empty", async () => {
    renderWithLang(<LoginForm onSubmit={vi.fn()} loading={false} error={null} />)
    await userEvent.type(screen.getByLabelText("Email"), "user@test.com")
    fireEvent.submit(screen.getByRole("button", { name: "Se connecter" }))
    await screen.findByText("Mot de passe requis")
  })

  it("does not call onSubmit when both fields are empty", async () => {
    const onSubmit = vi.fn()
    renderWithLang(<LoginForm onSubmit={onSubmit} loading={false} error={null} />)
    fireEvent.submit(screen.getByRole("button", { name: "Se connecter" }))
    await waitFor(() => expect(onSubmit).not.toHaveBeenCalled())
  })

  it("disables the submit button and shows loading label", () => {
    renderWithLang(<LoginForm onSubmit={vi.fn()} loading={true} error={null} />)
    expect(screen.getByRole("button", { name: "Connexion…" })).toBeDisabled()
  })

  it("displays an API-level error message", () => {
    renderWithLang(<LoginForm onSubmit={vi.fn()} loading={false} error="Identifiants invalides." />)
    expect(screen.getByText("Identifiants invalides.")).toBeInTheDocument()
  })

  it("does not display an error when the error prop is null", () => {
    const { container } = renderWithLang(
      <LoginForm onSubmit={vi.fn()} loading={false} error={null} />,
    )
    expect(container.querySelectorAll(".text-destructive")).toHaveLength(0)
  })
})
