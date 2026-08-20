import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RegisterForm } from "@/components/auth/RegisterForm"
import { LanguageProvider } from "@/context/LanguageContext"

function renderWithLang(ui: React.ReactElement) {
  return render(<LanguageProvider>{ui}</LanguageProvider>)
}

describe("RegisterForm", () => {
  it("renders name, email and password inputs", () => {
    renderWithLang(<RegisterForm onSubmit={vi.fn()} loading={false} error={null} />)
    expect(screen.getByLabelText("Nom")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument()
  })

  it("calls onSubmit with the entered values on valid submission", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    renderWithLang(<RegisterForm onSubmit={onSubmit} loading={false} error={null} />)

    await userEvent.type(screen.getByLabelText("Nom"), "Alice")
    await userEvent.type(screen.getByLabelText("Email"), "alice@test.com")
    await userEvent.type(screen.getByLabelText("Mot de passe"), "password123")
    fireEvent.submit(screen.getByRole("button", { name: "Créer un compte" }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("Alice", "alice@test.com", "password123")
    })
  })

  it("shows a validation error for an invalid email", async () => {
    renderWithLang(<RegisterForm onSubmit={vi.fn()} loading={false} error={null} />)
    await userEvent.type(screen.getByLabelText("Nom"), "Alice")
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email")
    await userEvent.type(screen.getByLabelText("Mot de passe"), "password123")
    fireEvent.submit(screen.getByRole("button", { name: "Créer un compte" }))
    await screen.findByText("Email invalide")
  })

  it("shows a validation error when the name is empty", async () => {
    renderWithLang(<RegisterForm onSubmit={vi.fn()} loading={false} error={null} />)
    await userEvent.type(screen.getByLabelText("Email"), "alice@test.com")
    await userEvent.type(screen.getByLabelText("Mot de passe"), "password123")
    fireEvent.submit(screen.getByRole("button", { name: "Créer un compte" }))
    await screen.findByText("Nom requis")
  })

  it("shows a validation error when the password is too short", async () => {
    renderWithLang(<RegisterForm onSubmit={vi.fn()} loading={false} error={null} />)
    await userEvent.type(screen.getByLabelText("Nom"), "Alice")
    await userEvent.type(screen.getByLabelText("Email"), "alice@test.com")
    await userEvent.type(screen.getByLabelText("Mot de passe"), "short")
    fireEvent.submit(screen.getByRole("button", { name: "Créer un compte" }))
    await screen.findByText("8 caractères minimum")
  })

  it("disables the submit button and shows the loading label", () => {
    renderWithLang(<RegisterForm onSubmit={vi.fn()} loading={true} error={null} />)
    expect(screen.getByRole("button", { name: "Création…" })).toBeDisabled()
  })

  it("displays an API-level error message", () => {
    renderWithLang(
      <RegisterForm onSubmit={vi.fn()} loading={false} error="Un compte existe déjà." />,
    )
    expect(screen.getByText("Un compte existe déjà.")).toBeInTheDocument()
  })
})
