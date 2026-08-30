import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ImportExportButtons } from "@/components/feed/ImportExportButtons"
import { LanguageProvider } from "@/context/LanguageContext"
import { buildOpml } from "@/lib/opml"
import { addUserRepository, getProviderFluxes, subscribeFlux } from "@/lib/api"
import { readToken, readApiUrl } from "@/lib/store"
import { save, open } from "@tauri-apps/plugin-dialog"
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs"
import type { FeedFlux } from "@/hooks/useFeed"

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: vi.fn(), open: vi.fn() }))
vi.mock("@tauri-apps/plugin-fs", () => ({ writeTextFile: vi.fn(), readTextFile: vi.fn() }))
vi.mock("@/lib/api", () => ({
  addUserRepository: vi.fn().mockResolvedValue(undefined),
  getProviderFluxes: vi.fn().mockResolvedValue([]),
  subscribeFlux: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/store", () => ({
  readToken: vi.fn().mockResolvedValue("token-1"),
  readApiUrl: vi.fn().mockResolvedValue("https://api.test"),
  readLang: vi.fn().mockResolvedValue(null),
  writeLang: vi.fn().mockResolvedValue(undefined),
}))

function flux(overrides: Partial<FeedFlux> = {}): FeedFlux {
  return {
    id: "l1",
    repository_id: 1,
    provider: "changelog",
    url: "https://github.com/facebook/react/",
    identifier: "facebook/react",
    instanceId: "i1",
    instanceName: "api.test",
    ...overrides,
  }
}

function renderButtons(fluxes: FeedFlux[] = [], onSuccess = vi.fn()) {
  render(
    <LanguageProvider initialLang="fr">
      <ImportExportButtons fluxes={fluxes} userId="user-1" onSuccess={onSuccess} />
    </LanguageProvider>,
  )
  return { onSuccess }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readToken).mockResolvedValue("token-1")
  vi.mocked(readApiUrl).mockResolvedValue("https://api.test")
})

describe("export", () => {
  it("writes the OPML file when a save path is chosen", async () => {
    vi.mocked(save).mockResolvedValue("/tmp/feeds.opml")
    renderButtons([flux()])

    fireEvent.click(screen.getByLabelText("Exporter les flux"))

    await waitFor(() => expect(writeTextFile).toHaveBeenCalled())
    const [path, content] = vi.mocked(writeTextFile).mock.calls[0]
    expect(path).toBe("/tmp/feeds.opml")
    expect(content).toContain('xmlUrl="https://github.com/facebook/react/"')
  })

  it("does nothing when the save dialog is cancelled", async () => {
    vi.mocked(save).mockResolvedValue(null)
    renderButtons([flux()])

    fireEvent.click(screen.getByLabelText("Exporter les flux"))

    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(writeTextFile).not.toHaveBeenCalled()
  })
})

describe("import", () => {
  it("does nothing when the open dialog is cancelled", async () => {
    vi.mocked(open).mockResolvedValue(null)
    renderButtons([])

    fireEvent.click(screen.getByLabelText("Importer des flux"))

    await waitFor(() => expect(open).toHaveBeenCalled())
    expect(readTextFile).not.toHaveBeenCalled()
  })

  it("adds new entries and reports the count", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/feeds.opml")
    vi.mocked(readTextFile).mockResolvedValue(
      buildOpml(
        [{ provider: "rss", url: "https://blog.example.com/feed.xml", identifier: "blog" }],
        "StayUp",
      ),
    )
    const { onSuccess } = renderButtons([])

    fireEvent.click(screen.getByLabelText("Importer des flux"))

    await screen.findByText(/1 ajouté/)
    expect(addUserRepository).toHaveBeenCalledWith("user-1", "token-1", "https://api.test", {
      provider: "rss",
      url: "https://blog.example.com/feed.xml",
      config: { max_scraps: 5, retention_days: 15 },
    })
    expect(onSuccess).toHaveBeenCalled()
  })

  it("skips entries already present without calling the API", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/feeds.opml")
    vi.mocked(readTextFile).mockResolvedValue(
      buildOpml(
        [
          {
            provider: "changelog",
            url: "https://github.com/facebook/react/",
            identifier: "facebook/react",
          },
        ],
        "StayUp",
      ),
    )
    const { onSuccess } = renderButtons([flux()])

    fireEvent.click(screen.getByLabelText("Importer des flux"))

    await screen.findByText(/1 déjà présent/)
    expect(addUserRepository).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("marks a scrap entry unavailable when no matching repository is subscribable", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/feeds.opml")
    vi.mocked(readTextFile).mockResolvedValue(
      buildOpml(
        [
          {
            provider: "scrap",
            url: "https://news.ycombinator.com",
            identifier: "news.ycombinator.com",
          },
        ],
        "StayUp",
      ),
    )
    vi.mocked(getProviderFluxes).mockResolvedValue([])
    renderButtons([])

    fireEvent.click(screen.getByLabelText("Importer des flux"))

    await screen.findByText(/1 indisponible/)
    expect(subscribeFlux).not.toHaveBeenCalled()
  })

  it("subscribes to a matching scrap repository", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/feeds.opml")
    vi.mocked(readTextFile).mockResolvedValue(
      buildOpml(
        [
          {
            provider: "scrap",
            url: "https://news.ycombinator.com",
            identifier: "news.ycombinator.com",
          },
        ],
        "StayUp",
      ),
    )
    vi.mocked(getProviderFluxes).mockResolvedValue([
      {
        id: 7,
        url: "https://news.ycombinator.com",
        config: {},
        created_at: "",
        is_subscribed: false,
      },
    ])
    renderButtons([])

    fireEvent.click(screen.getByLabelText("Importer des flux"))

    await screen.findByText(/1 ajouté/)
    expect(subscribeFlux).toHaveBeenCalledWith("scrap", 7, "token-1", "https://api.test")
  })

  it("shows an error for a file with no valid entries", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/feeds.opml")
    vi.mocked(readTextFile).mockResolvedValue("not opml")
    renderButtons([])

    fireEvent.click(screen.getByLabelText("Importer des flux"))

    await screen.findByText("Ce fichier n'a pas pu être lu comme un fichier OPML valide.")
    expect(addUserRepository).not.toHaveBeenCalled()
  })

  it("dismisses the error message when close is clicked", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/feeds.opml")
    vi.mocked(readTextFile).mockResolvedValue("not opml")
    renderButtons([])

    fireEvent.click(screen.getByLabelText("Importer des flux"))
    await screen.findByText("Ce fichier n'a pas pu être lu comme un fichier OPML valide.")

    fireEvent.click(screen.getByText("Fermer"))
    expect(
      screen.queryByText("Ce fichier n'a pas pu être lu comme un fichier OPML valide."),
    ).not.toBeInTheDocument()
  })

  it("dismisses the result message when close is clicked", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/feeds.opml")
    vi.mocked(readTextFile).mockResolvedValue(
      buildOpml(
        [{ provider: "rss", url: "https://blog.example.com/feed.xml", identifier: "blog" }],
        "StayUp",
      ),
    )
    renderButtons([])

    fireEvent.click(screen.getByLabelText("Importer des flux"))
    await screen.findByText(/1 ajouté/)

    fireEvent.click(screen.getByText("Fermer"))
    expect(screen.queryByText(/1 ajouté/)).not.toBeInTheDocument()
  })

  it("does not count a failed add towards any bucket", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/feeds.opml")
    vi.mocked(readTextFile).mockResolvedValue(
      buildOpml(
        [{ provider: "rss", url: "https://blog.example.com/feed.xml", identifier: "blog" }],
        "StayUp",
      ),
    )
    vi.mocked(addUserRepository).mockRejectedValue(new Error("boom"))
    renderButtons([])

    fireEvent.click(screen.getByLabelText("Importer des flux"))

    await waitFor(() => expect(addUserRepository).toHaveBeenCalled())
    expect(screen.queryByText(/ajouté|présent|indisponible/)).not.toBeInTheDocument()
  })

  it("treats a scrap lookup failure as unavailable", async () => {
    vi.mocked(open).mockResolvedValue("/tmp/feeds.opml")
    vi.mocked(readTextFile).mockResolvedValue(
      buildOpml(
        [
          {
            provider: "scrap",
            url: "https://news.ycombinator.com",
            identifier: "news.ycombinator.com",
          },
        ],
        "StayUp",
      ),
    )
    vi.mocked(getProviderFluxes).mockRejectedValue(new Error("boom"))
    renderButtons([])

    fireEvent.click(screen.getByLabelText("Importer des flux"))

    await screen.findByText(/1 indisponible/)
  })
})
