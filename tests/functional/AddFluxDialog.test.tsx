import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AddFluxDialog } from "@/components/feed/AddFluxDialog"
import { LanguageProvider } from "@/context/LanguageContext"
import { fr } from "@/lib/translations/fr"
import { TEMPLATES } from "./_templates"
import {
  addUserRepository,
  getConnectorProviders,
  getProviderFluxes,
  subscribeFlux,
} from "@/lib/api"
import { readToken, readApiUrl } from "@/lib/store"

vi.mock("@/lib/api", () => ({
  addUserRepository: vi.fn().mockResolvedValue({ repository: { id: "r1" } }),
  getProviderFluxes: vi.fn(),
  subscribeFlux: vi.fn().mockResolvedValue(undefined),
  getConnectorProviders: vi.fn(),
}))
vi.mock("@/lib/store", () => ({
  readToken: vi.fn(),
  readApiUrl: vi.fn().mockResolvedValue("https://api.test"),
  readLang: vi.fn().mockResolvedValue(null),
  writeLang: vi.fn().mockResolvedValue(undefined),
}))

function renderDialog(open = true) {
  const onClose = vi.fn()
  const onSuccess = vi.fn()
  const view = render(
    <LanguageProvider initialLang="fr">
      <AddFluxDialog open={open} onClose={onClose} userId="user-1" onSuccess={onSuccess} />
    </LanguageProvider>,
  )
  return { ...view, onClose, onSuccess }
}

const PROVIDER_LABELS: Record<string, string> = {
  changelog: "Changelog",
  youtube: "YouTube",
  rss: "RSS",
  scrap: "Scrap",
}

async function selectProvider(value: string) {
  fireEvent.click(await screen.findByRole("button", { name: PROVIDER_LABELS[value] }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readToken).mockResolvedValue("jwt")
  vi.mocked(readApiUrl).mockResolvedValue("https://api.test")
  vi.mocked(getProviderFluxes).mockResolvedValue([])
  vi.mocked(getConnectorProviders).mockResolvedValue(
    Object.entries(PROVIDER_LABELS).map(([name, displayName]) => ({
      name,
      displayName,
      fluxApproval: name === "scrap" ? "manual" : "auto",
      template: TEMPLATES[name]?.template,
    })),
  )
})

describe("visibility", () => {
  it("renders nothing when closed", () => {
    const { container } = renderDialog(false)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the dialog title when open", () => {
    renderDialog()
    expect(screen.getByText(fr.addFlux.title)).toBeInTheDocument()
  })

  it("offers exactly the four supported providers", async () => {
    renderDialog()
    for (const label of Object.values(PROVIDER_LABELS)) {
      expect(await screen.findByRole("button", { name: label })).toBeInTheDocument()
    }
  })

  it("closes on cancel", () => {
    const { onClose } = renderDialog()
    fireEvent.click(screen.getByText(fr.addFlux.cancel))
    expect(onClose).toHaveBeenCalled()
  })
})

describe("add a new flux (form input)", () => {
  it("builds the repository url from the connector form and adds it", async () => {
    const { onSuccess, onClose } = renderDialog()
    await screen.findByRole("button", { name: "Changelog" })

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "https://github.com/facebook/react.git" },
    })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    await waitFor(() =>
      expect(addUserRepository).toHaveBeenCalledWith("user-1", "jwt", "https://api.test", {
        provider: "changelog",
        url: "https://github.com/facebook/react/",
        config: { max_scraps: 5, retention_days: 15 },
      }),
    )
    expect(onSuccess).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it("shows the connector form label and placeholder", async () => {
    renderDialog()
    await selectProvider("rss")
    expect(screen.getByText("RSS/Atom feed URL")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("https://blog.example.com/feed.xml")).toBeInTheDocument()
  })

  it("rejects an empty identifier", async () => {
    renderDialog()
    await screen.findByRole("button", { name: "Changelog" })
    fireEvent.click(screen.getByText(fr.addFlux.add))
    expect(await screen.findByText(fr.addFlux.requiredError)).toBeInTheDocument()
    expect(addUserRepository).not.toHaveBeenCalled()
  })

  it("shows the pending screen when the API answers 202 (provider `manual`)", async () => {
    vi.mocked(addUserRepository).mockResolvedValue({ status: "pending" })
    renderDialog()
    await selectProvider("scrap")

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "https://blog.dev" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    expect(await screen.findByText(fr.addFlux.requestSent)).toBeInTheDocument()
    expect(screen.getByText(fr.addFlux.close)).toBeInTheDocument()
  })

  it("surfaces the API error message", async () => {
    vi.mocked(addUserRepository).mockRejectedValue(new Error("StayUp API error 409"))
    renderDialog()
    await screen.findByRole("button", { name: "Changelog" })

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "facebook/react" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    expect(await screen.findByText("StayUp API error 409")).toBeInTheDocument()
  })
})

describe("subscribe to an existing flux", () => {
  it("lists the provider fluxes and subscribes to the selected one", async () => {
    vi.mocked(getProviderFluxes).mockResolvedValue([
      { id: 10, url: "https://free.example.com", config: {}, created_at: "", is_subscribed: false },
      { id: 11, url: "https://taken.example.com", config: {}, created_at: "", is_subscribed: true },
    ])
    const { onSuccess } = renderDialog()
    await selectProvider("rss")
    await screen.findByText("https://free.example.com")

    // The already-followed one is hidden.
    expect(screen.queryByText("https://taken.example.com")).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "10" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    await waitFor(() =>
      expect(subscribeFlux).toHaveBeenCalledWith("rss", 10, "jwt", "https://api.test"),
    )
    expect(onSuccess).toHaveBeenCalled()
  })

  it("rejects an empty selection", async () => {
    vi.mocked(getProviderFluxes).mockResolvedValue([
      { id: 10, url: "https://free.example.com", config: {}, created_at: "", is_subscribed: false },
    ])
    renderDialog()
    await selectProvider("rss")
    await screen.findByText("https://free.example.com")

    fireEvent.click(screen.getByText(fr.addFlux.add))
    expect(await screen.findByText(fr.addFlux.selectError)).toBeInTheDocument()
    expect(subscribeFlux).not.toHaveBeenCalled()
  })
})
