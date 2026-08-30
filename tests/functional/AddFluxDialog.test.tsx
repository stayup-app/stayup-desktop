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
import type { Instance } from "@/lib/store"

vi.mock("@/lib/api", () => ({
  addUserRepository: vi.fn().mockResolvedValue({ repository: { id: "r1" } }),
  getProviderFluxes: vi.fn(),
  subscribeFlux: vi.fn().mockResolvedValue(undefined),
  getConnectorProviders: vi.fn(),
}))

// Un JWT dont le `sub` est "user-1", pour que le dialogue en dérive l'userId.
const TOKEN = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub: "user-1" })).replace(/=/g, "")}.sig`
const INSTANCES: Instance[] = [{ id: "i1", url: "https://api.test", name: "Primary", token: TOKEN }]

function renderDialog(open = true, instances: Instance[] = INSTANCES) {
  const onClose = vi.fn()
  const onSuccess = vi.fn()
  const view = render(
    <LanguageProvider initialLang="fr">
      <AddFluxDialog open={open} onClose={onClose} instances={instances} onSuccess={onSuccess} />
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
      expect(addUserRepository).toHaveBeenCalledWith("user-1", TOKEN, "https://api.test", {
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

    fireEvent.change(screen.getByRole("combobox"), { target: { value: ":10" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    await waitFor(() =>
      expect(subscribeFlux).toHaveBeenCalledWith("rss", 10, TOKEN, "https://api.test", undefined),
    )
    expect(onSuccess).toHaveBeenCalled()
  })

  it("subscribes to a flux living in a secondary database", async () => {
    vi.mocked(getProviderFluxes).mockResolvedValue([
      {
        id: 4,
        url: "https://ext.example.com",
        config: {},
        created_at: "2026-01-01",
        is_subscribed: false,
        dataSourceId: 7,
        dataSourceName: "Team feeds",
      },
    ])
    renderDialog()
    await selectProvider("rss")
    await screen.findByText(/https:\/\/ext\.example\.com/)

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "7:4" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    await waitFor(() =>
      expect(subscribeFlux).toHaveBeenCalledWith("rss", 4, TOKEN, "https://api.test", 7),
    )
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

  it("surfaces an error raised while subscribing", async () => {
    vi.mocked(getProviderFluxes).mockResolvedValue([
      { id: 10, url: "https://free.example.com", config: {}, created_at: "", is_subscribed: false },
    ])
    vi.mocked(subscribeFlux).mockRejectedValue(new Error("subscribe failed"))
    renderDialog()
    await selectProvider("rss")
    await screen.findByText("https://free.example.com")

    fireEvent.change(screen.getByRole("combobox"), { target: { value: ":10" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))
    expect(await screen.findByText("subscribe failed")).toBeInTheDocument()
  })

  it("fails closed when there is no instance to target", async () => {
    renderDialog(true, [])
    fireEvent.click(screen.getByText(fr.addFlux.makeRequest))
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "facebook/react" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    expect(await screen.findByText(fr.feed.tokenMissing)).toBeInTheDocument()
    expect(addUserRepository).not.toHaveBeenCalled()
  })
})

describe("pick mode & guards", () => {
  it("toggles between the existing-flux list and the new-flux form", async () => {
    vi.mocked(getProviderFluxes).mockResolvedValue([
      { id: 10, url: "https://free.example.com", config: {}, created_at: "", is_subscribed: false },
    ])
    renderDialog()
    await screen.findByText("https://free.example.com")

    fireEvent.click(screen.getByText(fr.addFlux.makeRequest))
    expect(screen.getByRole("textbox")).toBeInTheDocument()

    fireEvent.click(screen.getByText(fr.addFlux.chooseExisting))
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("rejects an identifier that does not match the connector pattern", async () => {
    renderDialog()
    await selectProvider("rss") // pattern: ^https?://.+
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "not-a-url" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))
    expect(await screen.findByText(fr.addFlux.requiredError)).toBeInTheDocument()
    expect(addUserRepository).not.toHaveBeenCalled()
  })

  it("fetches providers and fluxes against the selected instance", async () => {
    const second: Instance = { id: "i2", url: "https://b.test", name: "Beta", token: TOKEN }
    renderDialog(true, [INSTANCES[0], second])
    await screen.findByRole("button", { name: "Changelog" })

    // The instance selector appears once there is more than one.
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "i2" } })

    await waitFor(() =>
      expect(getConnectorProviders).toHaveBeenLastCalledWith(TOKEN, "https://b.test"),
    )
  })

  it("loads no fluxes when there is no instance", async () => {
    renderDialog(true, [])
    // No provider tiles, no flux fetch.
    expect(getProviderFluxes).not.toHaveBeenCalled()
    expect(getConnectorProviders).not.toHaveBeenCalled()
  })

  it("shows no provider tiles when the connector list fails to load", async () => {
    vi.mocked(getConnectorProviders).mockRejectedValue(new Error("offline"))
    renderDialog()
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Changelog" })).not.toBeInTheDocument(),
    )
    expect(screen.getByText(fr.addFlux.title)).toBeInTheDocument()
  })

  it("treats a failed flux fetch as an empty list on the new-flux form", async () => {
    vi.mocked(getProviderFluxes).mockRejectedValue(new Error("boom"))
    renderDialog()
    await screen.findByRole("button", { name: "Changelog" })
    expect(await screen.findByRole("textbox")).toBeInTheDocument()
  })

  it("tolerates a flux endpoint that resolves nothing", async () => {
    vi.mocked(getProviderFluxes).mockResolvedValue(undefined as never)
    renderDialog()
    expect(await screen.findByRole("textbox")).toBeInTheDocument()
  })

  it("disables the picker when every flux of the provider is already followed", async () => {
    vi.mocked(getProviderFluxes).mockResolvedValue([
      { id: 1, url: "https://taken.example.com", config: {}, created_at: "", is_subscribed: true },
    ])
    renderDialog()
    await selectProvider("rss")
    // Every flux is already followed → the dialog opens on the new-flux form.
    await screen.findByRole("textbox")
    fireEvent.click(screen.getByText(fr.addFlux.chooseExisting))
    const select = (await screen.findByRole("combobox")) as HTMLSelectElement
    const disabled = select.querySelector("option[disabled]")
    expect(disabled?.textContent).toBe(fr.addFlux.noScrapRepos)
  })

  it("falls back to a plain error message when a non-Error is thrown", async () => {
    vi.mocked(addUserRepository).mockRejectedValue("nope")
    renderDialog()
    await screen.findByRole("button", { name: "Changelog" })
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "facebook/react" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))
    expect(await screen.findByText(fr.common.error)).toBeInTheDocument()
  })

  it("falls back to a plain error message when subscribing throws a non-Error", async () => {
    vi.mocked(getProviderFluxes).mockResolvedValue([
      { id: 9, url: "https://free.example.com", config: {}, created_at: "", is_subscribed: false },
    ])
    vi.mocked(subscribeFlux).mockRejectedValue("boom")
    renderDialog()
    await selectProvider("rss")
    await screen.findByText("https://free.example.com")
    fireEvent.change(screen.getByRole("combobox"), { target: { value: ":9" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))
    expect(await screen.findByText(fr.common.error)).toBeInTheDocument()
  })

  it("renders a provider with no template, displayName or approval flag", async () => {
    vi.mocked(getConnectorProviders).mockResolvedValue([{ name: "bare", template: null } as never])
    renderDialog()
    expect(await screen.findByRole("button", { name: "bare" })).toBeInTheDocument()
  })
})
