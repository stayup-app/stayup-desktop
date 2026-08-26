import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiUrlForm } from "@/components/profile/ApiUrlForm"
import { LanguageProvider } from "@/context/LanguageContext"
import { readApiUrl, resetApiUrl, writeApiUrl } from "@/lib/store"

vi.mock("@/lib/store", () => ({
  readApiUrl: vi.fn(),
  writeApiUrl: vi.fn(),
  resetApiUrl: vi.fn(),
  readLang: vi.fn().mockResolvedValue(null),
  writeLang: vi.fn().mockResolvedValue(undefined),
}))

function renderForm() {
  return render(
    <LanguageProvider initialLang="fr">
      <ApiUrlForm />
    </LanguageProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readApiUrl).mockResolvedValue("https://api.example.com")
  vi.mocked(writeApiUrl).mockResolvedValue(undefined)
  vi.mocked(resetApiUrl).mockResolvedValue(undefined)
})

describe("ApiUrlForm", () => {
  it("prefills the current API URL", async () => {
    renderForm()
    expect(await screen.findByLabelText("URL de l'API")).toHaveValue("https://api.example.com")
  })

  it("saves a new URL and shows a success message", async () => {
    renderForm()
    const input = await screen.findByLabelText("URL de l'API")
    await userEvent.clear(input)
    await userEvent.type(input, "https://other-api.example.com")
    fireEvent.submit(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() => expect(writeApiUrl).toHaveBeenCalledWith("https://other-api.example.com"))
    expect(await screen.findByText("URL de l'API mise à jour.")).toBeInTheDocument()
  })

  it("rejects an invalid URL without calling writeApiUrl", async () => {
    renderForm()
    const input = await screen.findByLabelText("URL de l'API")
    await userEvent.clear(input)
    await userEvent.type(input, "not-a-url")
    fireEvent.submit(screen.getByRole("button", { name: "Enregistrer" }))

    expect(await screen.findByText("Saisis une URL valide.")).toBeInTheDocument()
    expect(writeApiUrl).not.toHaveBeenCalled()
  })

  it("resets to the default API URL", async () => {
    renderForm()
    await screen.findByLabelText("URL de l'API")
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser par défaut" }))

    await waitFor(() => expect(resetApiUrl).toHaveBeenCalled())
  })
})
