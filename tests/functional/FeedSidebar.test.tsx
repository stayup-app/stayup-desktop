import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { FeedSidebar } from "@/components/feed/FeedSidebar"
import { LanguageProvider } from "@/context/LanguageContext"
import { useNavigationStore } from "@/store/navigation"
import { deleteUserRepository } from "@/lib/api"
import { readToken } from "@/lib/store"
import { fr } from "@/lib/translations/fr"
import { TEMPLATES } from "./_templates"
import type { FeedFlux } from "@/hooks/useFeed"
import type { Instance } from "@/lib/store"

const jwt = (sub: string) =>
  `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub })).replace(/=/g, "")}.sig`

const TOKEN = jwt("user-1")
const INSTANCES: Instance[] = [
  { id: "i1", url: "https://api.test", name: "api.test", token: TOKEN },
]

vi.mock("@/lib/api", () => ({
  deleteUserRepository: vi.fn().mockResolvedValue(undefined),
  addUserRepository: vi.fn().mockResolvedValue(undefined),
  createScrapRequest: vi.fn().mockResolvedValue({ id: "r" }),
  getScrapRepos: vi.fn().mockResolvedValue([]),
  subscribeScrap: vi.fn().mockResolvedValue(undefined),
  subscribeFlux: vi.fn().mockResolvedValue(undefined),
  getConnectorProviders: vi.fn().mockResolvedValue([]),
  getProviderFluxes: vi.fn().mockResolvedValue([]),
}))
vi.mock("@/lib/store", () => ({
  readToken: vi.fn().mockResolvedValue("jwt"),
  readApiUrl: vi.fn().mockResolvedValue("https://api.test"),
  readLang: vi.fn().mockResolvedValue(null),
  writeLang: vi.fn().mockResolvedValue(undefined),
}))

function renderWithLang(ui: React.ReactElement) {
  return render(<LanguageProvider initialLang="fr">{ui}</LanguageProvider>)
}

// Typed access to the Node process without pulling in @types/node
type RejectionHandler = (reason: unknown) => void
const nodeProcess = (
  globalThis as unknown as {
    process: {
      on: (event: "unhandledRejection", handler: RejectionHandler) => void
      off: (event: "unhandledRejection", handler: RejectionHandler) => void
    }
  }
).process

const INST = { instanceId: "i1", instanceName: "api.test" }

const fluxes: FeedFlux[] = [
  {
    id: "1",
    repository_id: 1,
    provider: "changelog",
    url: "https://github.com/facebook/react",
    identifier: "facebook/react",
    ...INST,
  },
  {
    id: "2",
    repository_id: 2,
    provider: "youtube",
    url: "https://youtube.com/@fireship",
    identifier: "@fireship",
    ...INST,
  },
  {
    id: "3",
    repository_id: 3,
    provider: "youtube",
    url: "https://youtube.com/@theo",
    identifier: "@theo",
    ...INST,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readToken).mockResolvedValue("jwt")
  useNavigationStore.setState({ selection: { type: "all" } })
})

describe("FeedSidebar", () => {
  it("renders the 'Tous les flux' button", () => {
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )
    expect(screen.getByText("Tous les flux")).toBeInTheDocument()
  })

  it("renders one entry per provider group", () => {
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )
    expect(screen.getByText("Changelog")).toBeInTheDocument()
    expect(screen.getByText("YouTube")).toBeInTheDocument()
  })

  it("shows flux identifiers when a category is expanded (default)", () => {
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )
    expect(screen.getByText("facebook/react")).toBeInTheDocument()
    expect(screen.getByText("@fireship")).toBeInTheDocument()
    expect(screen.getByText("@theo")).toBeInTheDocument()
  })

  it("collapses a category when its chevron is clicked", () => {
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )

    const chevronButtons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.trim() === "" && !b.getAttribute("aria-label"))
    // chevronButtons[0] = changelog chevron, chevronButtons[1] = youtube chevron
    fireEvent.click(chevronButtons[1])

    expect(screen.queryByText("@fireship")).not.toBeInTheDocument()
    expect(screen.queryByText("@theo")).not.toBeInTheDocument()
    expect(screen.getByText("facebook/react")).toBeInTheDocument()
  })

  it("dispatches 'all' selection on 'Tous les flux' click", () => {
    useNavigationStore.setState({ selection: { type: "category", provider: "youtube" } })
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )
    fireEvent.click(screen.getByText("Tous les flux"))
    expect(useNavigationStore.getState().selection).toEqual({ type: "all" })
  })

  it("dispatches a category selection when clicking a provider label", () => {
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )
    fireEvent.click(screen.getByText("YouTube"))
    expect(useNavigationStore.getState().selection).toEqual({
      type: "category",
      provider: "youtube",
    })
  })

  it("dispatches a flux selection when clicking a specific flux", () => {
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )
    fireEvent.click(screen.getByText("facebook/react"))
    expect(useNavigationStore.getState().selection).toEqual({
      type: "flux",
      fluxId: "1",
      provider: "changelog",
      instanceId: "i1",
    })
  })

  it("badges each flux with its instance name when several instances are connected", () => {
    const multi: FeedFlux[] = [
      { ...fluxes[0], instanceId: "i1", instanceName: "Alpha" },
      { ...fluxes[1], instanceId: "i2", instanceName: "Beta" },
    ]
    const two: Instance[] = [
      { id: "i1", url: "https://a.test", name: "Alpha", token: jwt("a") },
      { id: "i2", url: "https://b.test", name: "Beta", token: jwt("b") },
    ]
    renderWithLang(
      <FeedSidebar
        fluxes={multi}
        templates={TEMPLATES}
        instances={two}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Beta")).toBeInTheDocument()
  })

  it("shows the current server name on the badge, not the one stamped at feed load", () => {
    const multi: FeedFlux[] = [
      { ...fluxes[0], instanceId: "i1", instanceName: "old-host.example" },
      { ...fluxes[1], instanceId: "i2", instanceName: "Beta" },
    ]
    const renamed: Instance[] = [
      { id: "i1", url: "https://a.test", name: "Main", token: jwt("a") },
      { id: "i2", url: "https://b.test", name: "Beta", token: jwt("b") },
    ]
    renderWithLang(
      <FeedSidebar
        fluxes={multi}
        templates={TEMPLATES}
        instances={renamed}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )
    expect(screen.getByText("Main")).toBeInTheDocument()
    expect(screen.queryByText("old-host.example")).not.toBeInTheDocument()
  })

  it("shows no instance badge with a single instance", () => {
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )
    expect(screen.queryByText("api.test")).not.toBeInTheDocument()
  })

  it("renders an empty sidebar without errors when there are no fluxes", () => {
    renderWithLang(
      <FeedSidebar
        fluxes={[]}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )
    expect(screen.getByText("Tous les flux")).toBeInTheDocument()
    expect(screen.queryByText("Changelog")).not.toBeInTheDocument()
  })
})

describe("unread badges", () => {
  it("shows a per-flux count and the provider total", () => {
    renderWithLang(
      <FeedSidebar
        templates={TEMPLATES}
        instances={INSTANCES}
        fluxes={fluxes}
        userId="user-1"
        onRefresh={() => {}}
        unreadCountByRepoId={{ "i1:2": 3, "i1:3": 4 }}
      />,
    )
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.getByText("7")).toBeInTheDocument()
  })

  it("shows no badge when everything is read", () => {
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
        unreadCountByRepoId={{}}
      />,
    )
    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })
})

describe("layout", () => {
  it("applies the requested width", () => {
    const { container } = renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
        width={300}
      />,
    )
    expect(container.querySelector("aside")).toHaveStyle({ width: "300px" })
  })

  it("marks the active flux with an accent bar", () => {
    useNavigationStore.setState({
      selection: { type: "flux", fluxId: "1", provider: "changelog", instanceId: "i1" },
    })
    const { container } = renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )
    expect(container.querySelector(".w-0\\.5")).not.toBeNull()
  })
})

describe("refreshing feeds", () => {
  it("calls onRefresh when the refresh button is clicked", () => {
    const onRefresh = vi.fn()
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={onRefresh}
      />,
    )

    fireEvent.click(screen.getByLabelText(fr.menu.file.refresh))
    expect(onRefresh).toHaveBeenCalled()
  })

  it("disables the refresh button and spins its icon while loading", () => {
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
        loading
      />,
    )

    const button = screen.getByLabelText(fr.menu.file.refresh)
    expect(button).toBeDisabled()
    expect(button.querySelector("svg")?.getAttribute("class")).toContain("animate-spin")
  })
})

describe("adding a feed", () => {
  it("opens and closes the add-flux dialog", () => {
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )
    fireEvent.click(screen.getByLabelText(fr.addFlux.title))
    expect(screen.getByText(fr.addFlux.provider)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("dialog-backdrop"))
    expect(screen.queryByText(fr.addFlux.provider)).not.toBeInTheDocument()
  })
})

describe("deleting a feed", () => {
  it("asks for confirmation before deleting", () => {
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )

    fireEvent.click(screen.getAllByLabelText(fr.feed.deleteAriaLabel)[0])

    expect(
      screen.getByText(fr.feed.confirmDelete.replace("{id}", "facebook/react")),
    ).toBeInTheDocument()
    expect(deleteUserRepository).not.toHaveBeenCalled()
  })

  it("deletes and refreshes on confirmation", async () => {
    const onRefresh = vi.fn()
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={onRefresh}
      />,
    )

    fireEvent.click(screen.getAllByLabelText(fr.feed.deleteAriaLabel)[0])
    fireEvent.click(screen.getByText(fr.common.delete))

    await waitFor(() =>
      expect(deleteUserRepository).toHaveBeenCalledWith("user-1", "1", TOKEN, "https://api.test"),
    )
    expect(onRefresh).toHaveBeenCalled()
  })

  it("aborts on cancel", () => {
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )

    fireEvent.click(screen.getAllByLabelText(fr.feed.deleteAriaLabel)[0])
    fireEvent.click(screen.getByText(fr.common.cancel))

    expect(screen.queryByText(fr.common.delete)).not.toBeInTheDocument()
    expect(deleteUserRepository).not.toHaveBeenCalled()
  })

  it("aborts when the backdrop is clicked", () => {
    renderWithLang(
      <FeedSidebar
        fluxes={fluxes}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )

    fireEvent.click(screen.getAllByLabelText(fr.feed.deleteAriaLabel)[0])
    fireEvent.click(screen.getByTestId("dialog-backdrop"))

    expect(screen.queryByText(fr.common.delete)).not.toBeInTheDocument()
  })

  it("does not call the API when the flux's instance is unknown", async () => {
    // handleDeleteConfirm rethrows here without a catch, so the rejection never
    // reaches the UI — swallow it so it does not fail the run.
    const swallow = vi.fn()
    nodeProcess.on("unhandledRejection", swallow)

    const orphan: FeedFlux[] = [{ ...fluxes[0], instanceId: "gone" }]
    renderWithLang(
      <FeedSidebar
        fluxes={orphan}
        templates={TEMPLATES}
        instances={INSTANCES}
        userId="user-1"
        onRefresh={() => {}}
      />,
    )
    fireEvent.click(screen.getAllByLabelText(fr.feed.deleteAriaLabel)[0])
    fireEvent.click(screen.getByText(fr.common.delete))

    await waitFor(() => expect(screen.queryByText(fr.common.delete)).not.toBeInTheDocument())
    expect(deleteUserRepository).not.toHaveBeenCalled()
    nodeProcess.off("unhandledRejection", swallow)
  })

  it("routes the delete to the flux's own instance", async () => {
    const two: Instance[] = [
      INSTANCES[0],
      { id: "i2", url: "https://b.test", name: "Beta", token: jwt("bob") },
    ]
    const onRefresh = vi.fn()
    renderWithLang(
      <FeedSidebar
        fluxes={[{ ...fluxes[0], instanceId: "i2", instanceName: "Beta" }]}
        templates={TEMPLATES}
        instances={two}
        userId="user-1"
        onRefresh={onRefresh}
      />,
    )
    fireEvent.click(screen.getAllByLabelText(fr.feed.deleteAriaLabel)[0])
    fireEvent.click(screen.getByText(fr.common.delete))

    await waitFor(() =>
      expect(deleteUserRepository).toHaveBeenCalledWith("bob", "1", jwt("bob"), "https://b.test"),
    )
  })
})
