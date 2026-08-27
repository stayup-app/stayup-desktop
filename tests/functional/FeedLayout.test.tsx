import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import { open } from "@tauri-apps/plugin-shell"
import { FeedLayout } from "@/components/feed/FeedLayout"
import { LanguageProvider } from "@/context/LanguageContext"
import { ThemeProvider } from "@/context/ThemeContext"
import { useNavigationStore } from "@/store/navigation"
import { useReadItemsStore } from "@/store/readItems"
import { fr } from "@/lib/translations/fr"
import { useFeed } from "@/hooks/useFeed"
import type { AppSession } from "@/lib/session"

vi.mock("@/hooks/useFeed", () => ({ useFeed: vi.fn() }))
vi.mock("@/hooks/useMenu", () => ({ useMenu: vi.fn() }))
vi.mock("@/lib/store", () => ({
  readToken: vi.fn().mockResolvedValue("jwt"),
  readApiUrl: vi.fn().mockResolvedValue("https://api.test"),
  readLang: vi.fn().mockResolvedValue(null),
  writeLang: vi.fn().mockResolvedValue(undefined),
  readReadItems: vi.fn().mockResolvedValue([]),
  writeReadItems: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/api", () => ({
  deleteUserRepository: vi.fn().mockResolvedValue(undefined),
  addUserRepository: vi.fn().mockResolvedValue(undefined),
  createScrapRequest: vi.fn().mockResolvedValue({ id: "r" }),
  getScrapRepos: vi.fn().mockResolvedValue([]),
  subscribeScrap: vi.fn().mockResolvedValue(undefined),
  updateProfile: vi.fn().mockResolvedValue(undefined),
}))

const session: AppSession = {
  userId: "alice",
  name: "Alice",
  email: "alice@test.com",
  role: "user",
}

const fluxes = [
  {
    id: "1",
    repository_id: 1,
    provider: "changelog" as const,
    url: "https://github.com/facebook/react",
    identifier: "facebook/react",
  },
  {
    id: "2",
    repository_id: 2,
    provider: "youtube" as const,
    url: "https://www.youtube.com/@fireship",
    identifier: "@fireship",
  },
]

const connectors = {
  changelog: [
    {
      id: 1,
      repository_id: 1,
      content: "React 19 notes",
      datetime: "2024-06-15T10:00:00Z",
      executed_at: "2024-06-15T10:00:00Z",
      success: true,
      version: "v19.0.0",
    },
  ],
  youtube: [
    {
      id: 2,
      repository_id: 2,
      version: "vid1",
      content: JSON.stringify({
        title: "Newest video",
        url: "https://www.youtube.com/@fireship",
        link: "https://youtu.be/vid1",
      }),
      datetime: "2024-06-16T10:00:00Z",
      executed_at: "2024-06-16T10:00:00Z",
      success: true,
    },
  ],
  rss: [
    {
      id: 3,
      repository_id: 3,
      content: JSON.stringify({ version: "e1", title: "Blog entry", link: "https://blog.dev/p" }),
      datetime: "2024-06-14T10:00:00Z",
      executed_at: "2024-06-14T10:00:00Z",
      success: true,
    },
  ],
  scrap: [
    {
      id: 4,
      repository_id: 4,
      content: "Scraped line",
      params: { url: "https://news.dev", articles_selector: "a", content_selector: "p" },
      executed_at: "2024-06-13T10:00:00Z",
      success: true,
    },
  ],
}

type FeedState = ReturnType<typeof useFeed>

function mockFeed(overrides: Partial<FeedState> = {}) {
  vi.mocked(useFeed).mockReturnValue({
    fluxes,
    connectors,
    loading: false,
    error: null,
    refresh: vi.fn(),
    ...overrides,
  } as FeedState)
}

function renderLayout(props: Partial<React.ComponentProps<typeof FeedLayout>> = {}) {
  const onLogout = vi.fn()
  const onCheckUpdates = vi.fn()
  const view = render(
    <LanguageProvider initialLang="fr">
      <ThemeProvider>
        <FeedLayout
          session={session}
          onLogout={onLogout}
          onCheckUpdates={onCheckUpdates}
          {...props}
        />
      </ThemeProvider>
    </LanguageProvider>,
  )
  return { ...view, onLogout, onCheckUpdates }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useNavigationStore.setState({ selection: { type: "all" } })
  // Pre-initialized: otherwise the async init() resolves mid-test and resets readIds
  useReadItemsStore.setState({ readIds: new Set(), initialized: true })
  mockFeed()
})

describe("header", () => {
  it("shows the branding and the user initial", () => {
    const { container } = renderLayout()
    expect(screen.getByText("stayup")).toBeInTheDocument()
    expect(container.querySelector("header .rounded-full")).toHaveTextContent("A")
  })

  it("falls back to '?' when there is no name", () => {
    const { container } = renderLayout({
      session: { ...session, name: undefined as unknown as string },
    })
    expect(container.querySelector("header .rounded-full")).toHaveTextContent("?")
  })

  it("signs the user out", () => {
    const { onLogout } = renderLayout()
    fireEvent.click(screen.getByTitle(session.name))
    fireEvent.click(screen.getByText(fr.userMenu.signOut))
    expect(onLogout).toHaveBeenCalled()
  })

  it("opens and closes the profile modal from the user menu", () => {
    renderLayout()

    fireEvent.click(screen.getByTitle(session.name))
    fireEvent.click(screen.getByText(fr.userMenu.profile))
    expect(screen.getByText(fr.profile.title)).toBeInTheDocument()

    fireEvent.click(screen.getByText(fr.common.close))
    expect(screen.queryByText(fr.profile.title)).not.toBeInTheDocument()
  })
})

describe("feed list", () => {
  it("merges every connector, newest first", () => {
    const { container } = renderLayout()
    const rows = container.querySelectorAll("[data-index]")
    expect(rows).toHaveLength(4)
    expect(rows[0].textContent).toContain("Newest video")
  })

  it("shows the total count next to the 'all' filter", () => {
    renderLayout()
    expect(screen.getByText(fr.feed.filterAll).textContent).toContain("4")
  })

  it("shows only the selected category", () => {
    useNavigationStore.setState({ selection: { type: "category", provider: "youtube" } })
    const { container } = renderLayout()
    expect(container.querySelectorAll("[data-index]")).toHaveLength(1)
    expect(container.textContent).toContain("Newest video")
  })

  it.each([
    ["changelog", "React 19 notes"],
    ["rss", "Blog entry"],
    ["scrap", "Scraped line"],
  ] as const)("shows only the %s category", (provider, text) => {
    useNavigationStore.setState({ selection: { type: "category", provider } })
    const { container } = renderLayout()
    expect(container.querySelectorAll("[data-index]")).toHaveLength(1)
    expect(container.textContent).toContain(text)
  })

  it("shows only the items of the selected flux", () => {
    useNavigationStore.setState({
      selection: { type: "flux", fluxId: "1", provider: "changelog" },
    })
    const { container } = renderLayout()
    expect(container.querySelectorAll("[data-index]")).toHaveLength(1)
    expect(container.textContent).toContain("React 19 notes")
  })

  it("shows every item of the provider when the flux is unknown", () => {
    useNavigationStore.setState({
      selection: { type: "flux", fluxId: "missing", provider: "youtube" },
    })
    const { container } = renderLayout()
    expect(container.querySelectorAll("[data-index]")).toHaveLength(1)
  })

  it("renders nothing while the feed is loading", () => {
    mockFeed({ loading: true, connectors: null })
    renderLayout()
    expect(screen.getByText(fr.feed.loading)).toBeInTheDocument()
  })

  it("renders an error with a retry button", () => {
    const refresh = vi.fn()
    mockFeed({ loading: false, error: "Token manquant", connectors: null, refresh })
    renderLayout()

    expect(screen.getByText("Token manquant")).toBeInTheDocument()
    fireEvent.click(screen.getByText(fr.feed.retry))
    expect(refresh).toHaveBeenCalled()
  })
})

describe("read state", () => {
  it("marks an item read when it is opened", async () => {
    const { container } = renderLayout()

    fireEvent.click(container.querySelector('[data-index="0"]')!)

    await waitFor(() => expect(useReadItemsStore.getState().readIds.has("youtube:2")).toBe(true))
  })

  it("shows the item content once opened", async () => {
    const { container } = renderLayout()

    fireEvent.click(container.querySelector('[data-index="0"]')!)

    expect(await screen.findByText(fr.viewer.watchOnYoutube)).toBeInTheDocument()
  })

  it("counts unread items and hides read ones in unread mode", async () => {
    const { container } = renderLayout()
    expect(screen.getByText(fr.feed.filterUnread).textContent).toContain("4")

    fireEvent.click(container.querySelector('[data-index="3"]')!)
    await waitFor(() => expect(useReadItemsStore.getState().readIds.size).toBe(1))

    fireEvent.click(screen.getByText(fr.feed.filterAll))
    fireEvent.click(screen.getByText(fr.feed.filterUnread))

    // The open item stays visible so it can still be read
    expect(container.querySelectorAll("[data-index]")).toHaveLength(4)
  })

  it("marks every item in the view as read", async () => {
    renderLayout()

    fireEvent.click(screen.getByTitle(fr.feed.markAllRead))

    await waitFor(() => expect(useReadItemsStore.getState().readIds.size).toBe(4))
    await waitFor(() => expect(screen.queryByTitle(fr.feed.markAllRead)).not.toBeInTheDocument())
  })

  it("drops read ids that are no longer in the feed", async () => {
    useReadItemsStore.setState({ readIds: new Set(["changelog:999"]), initialized: true })
    renderLayout()

    await waitFor(() => expect(useReadItemsStore.getState().readIds.size).toBe(0))
  })
})

describe("keyboard navigation", () => {
  it("selects the first item on ArrowDown and moves down the list", async () => {
    const { container } = renderLayout()

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }))
    })
    await waitFor(() =>
      expect(container.querySelector<HTMLElement>('[data-index="0"]')!.style.background).toBe(
        "var(--surface-2)",
      ),
    )

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }))
    })
    await waitFor(() =>
      expect(container.querySelector<HTMLElement>('[data-index="1"]')!.style.background).toBe(
        "var(--surface-2)",
      ),
    )
  })

  it("moves back up on ArrowUp and stops at the top", async () => {
    const { container } = renderLayout()

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }))
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }))
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }))
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }))
    })

    await waitFor(() =>
      expect(container.querySelector<HTMLElement>('[data-index="0"]')!.style.background).toBe(
        "var(--surface-2)",
      ),
    )
  })

  it("selects the first item on ArrowUp when nothing is open", async () => {
    const { container } = renderLayout()

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }))
    })

    await waitFor(() =>
      expect(container.querySelector<HTMLElement>('[data-index="0"]')!.style.background).toBe(
        "var(--surface-2)",
      ),
    )
  })

  it("opens the external URL of the selected item on Enter", async () => {
    const { container } = renderLayout()
    fireEvent.click(container.querySelector('[data-index="0"]')!)

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
    })

    await waitFor(() => expect(open).toHaveBeenCalledWith("https://youtu.be/vid1"))
  })

  it.each([
    ["changelog", "https://github.com/facebook/react/releases/tag/v19.0.0"],
    ["rss", "https://blog.dev/p"],
    ["scrap", "https://news.dev"],
  ] as const)("opens the %s external URL on Enter", async (provider, url) => {
    useNavigationStore.setState({ selection: { type: "category", provider } })
    const { container } = renderLayout()
    fireEvent.click(container.querySelector('[data-index="0"]')!)

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
    })

    await waitFor(() => expect(open).toHaveBeenCalledWith(url))
  })

  it("does nothing on Enter when no item is open", () => {
    renderLayout()

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
    })

    expect(open).not.toHaveBeenCalled()
  })

  it("ignores keys typed inside an input", () => {
    const { container } = renderLayout()
    const input = document.createElement("input")
    document.body.appendChild(input)
    input.focus()

    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }))
    })

    expect(container.querySelector<HTMLElement>('[data-index="0"]')!.style.background).toBe("")
    input.remove()
  })
})

describe("external URLs that cannot be resolved", () => {
  it("does not open anything for an unparsable payload", async () => {
    mockFeed({
      connectors: {
        ...connectors,
        youtube: [{ ...connectors.youtube[0], content: "{bad" }],
        changelog: [],
        rss: [{ ...connectors.rss[0], content: "{bad" }],
        scrap: [{ ...connectors.scrap[0], params: "{bad" }],
      },
    })
    const { container } = renderLayout()

    fireEvent.click(container.querySelector('[data-index="0"]')!)
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
    })

    await waitFor(() => expect(useReadItemsStore.getState().readIds.size).toBe(1))
    expect(open).not.toHaveBeenCalled()
  })

  it("does not open a changelog release when the repository is unknown", async () => {
    mockFeed({ fluxes: [], connectors: { ...connectors, youtube: [], rss: [], scrap: [] } })
    const { container } = renderLayout()

    fireEvent.click(container.querySelector('[data-index="0"]')!)
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
    })

    await waitFor(() => expect(useReadItemsStore.getState().readIds.size).toBe(1))
    expect(open).not.toHaveBeenCalled()
  })
})

describe("resizable panels", () => {
  function dragBy(handle: Element, dx: number) {
    fireEvent.mouseDown(handle, { clientX: 100 })
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientX: 100 + dx }))
    })
    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"))
    })
  }

  it("resizes the sidebar and clamps to the allowed range", () => {
    const { container } = renderLayout()
    const [sidebarHandle] = container.querySelectorAll(".cursor-col-resize")
    const aside = container.querySelector("aside")!

    dragBy(sidebarHandle, 60)
    expect(aside).toHaveStyle({ width: "280px" })

    dragBy(sidebarHandle, 999)
    expect(aside).toHaveStyle({ width: "420px" })

    dragBy(sidebarHandle, -999)
    expect(aside).toHaveStyle({ width: "150px" })
  })

  it("resizes the list panel and clamps to the allowed range", () => {
    const { container } = renderLayout()
    const listHandle = container.querySelectorAll(".cursor-col-resize")[1]
    const listPanel = listHandle.previousElementSibling!

    dragBy(listHandle, 40)
    expect(listPanel).toHaveStyle({ width: "420px" })

    dragBy(listHandle, 999)
    expect(listPanel).toHaveStyle({ width: "600px" })

    dragBy(listHandle, -999)
    expect(listPanel).toHaveStyle({ width: "260px" })
  })

  it("restores the cursor styles after the drag", () => {
    const { container } = renderLayout()
    const [sidebarHandle] = container.querySelectorAll(".cursor-col-resize")

    fireEvent.mouseDown(sidebarHandle, { clientX: 100 })
    expect(document.body.style.cursor).toBe("col-resize")

    act(() => {
      window.dispatchEvent(new MouseEvent("mouseup"))
    })
    expect(document.body.style.cursor).toBe("")
  })
})

describe("partial connector payloads", () => {
  it("treats missing connector arrays as empty in every selection", () => {
    mockFeed({ connectors: {} as typeof connectors })
    const { container } = renderLayout()
    expect(container.querySelectorAll("[data-index]")).toHaveLength(0)
    expect(screen.getByText(fr.feed.noContent)).toBeInTheDocument()
  })

  it.each(["changelog", "youtube", "rss", "scrap"] as const)(
    "treats a missing %s array as empty in the category view",
    (provider) => {
      useNavigationStore.setState({ selection: { type: "category", provider } })
      mockFeed({ connectors: {} as typeof connectors })
      const { container } = renderLayout()
      expect(container.querySelectorAll("[data-index]")).toHaveLength(0)
    },
  )

  it.each(["changelog", "youtube", "rss", "scrap"] as const)(
    "treats a missing %s array as empty in the flux view",
    (provider) => {
      useNavigationStore.setState({ selection: { type: "flux", fluxId: "1", provider } })
      mockFeed({ connectors: {} as typeof connectors })
      const { container } = renderLayout()
      expect(container.querySelectorAll("[data-index]")).toHaveLength(0)
    },
  )
})

describe("external URL fallbacks", () => {
  it("uses the channel URL when a video has no direct link", async () => {
    mockFeed({
      connectors: {
        ...connectors,
        changelog: [],
        rss: [],
        scrap: [],
        youtube: [
          {
            ...connectors.youtube[0],
            content: JSON.stringify({ title: "T", url: "https://www.youtube.com/@fireship" }),
          },
        ],
      },
    })
    const { container } = renderLayout()
    fireEvent.click(container.querySelector('[data-index="0"]')!)

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
    })

    await waitFor(() => expect(open).toHaveBeenCalledWith("https://www.youtube.com/@fireship"))
  })

  it.each([
    [
      "a video payload with neither link nor url",
      { youtube: [{ ...connectors.youtube[0], content: JSON.stringify({ title: "T" }) }] },
    ],
    [
      "an rss payload with no link",
      { rss: [{ ...connectors.rss[0], content: JSON.stringify({ title: "T" }) }] },
    ],
    ["a scrap payload with no url", { scrap: [{ ...connectors.scrap[0], params: {} }] }],
    [
      "a scrap payload whose params are a JSON string without a url",
      { scrap: [{ ...connectors.scrap[0], params: JSON.stringify({}) }] },
    ],
  ] as const)("opens nothing for %s", async (_label, override) => {
    mockFeed({
      connectors: {
        changelog: [],
        youtube: [],
        rss: [],
        scrap: [],
        ...override,
      } as unknown as typeof connectors,
    })
    const { container } = renderLayout()
    fireEvent.click(container.querySelector('[data-index="0"]')!)

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
    })

    await waitFor(() => expect(useReadItemsStore.getState().readIds.size).toBe(1))
    expect(open).not.toHaveBeenCalled()
  })
})
