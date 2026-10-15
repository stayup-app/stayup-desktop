import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react"
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification"
import { FeedLayout } from "@/components/feed/FeedLayout"
import { FeedSidebar } from "@/components/feed/FeedSidebar"
import { FeedContentViewer } from "@/components/feed/FeedContentViewer"
import { NotificationsToggle } from "@/components/profile/NotificationsToggle"
import { LanguageProvider } from "@/context/LanguageContext"
import { ThemeProvider } from "@/context/ThemeContext"
import { useNavigationStore } from "@/store/navigation"
import { useReadItemsStore } from "@/store/readItems"
import { useFeed } from "@/hooks/useFeed"
import { useNewItemNotifications } from "@/hooks/useNewItemNotifications"
import { renderHook } from "@testing-library/react"
import {
  listSavedItems,
  searchItems,
  setRepositoryFolder,
  setItemSaved,
  getItemState,
} from "@/lib/api"
import {
  readLastNotifiedId,
  readNotificationsEnabled,
  writeLastNotifiedId,
  writeNotificationsEnabled,
} from "@/lib/store"
import { en } from "@/lib/translations/en"
import type { AppSession } from "@/lib/session"
import type { ConnectorItem, TaggedItem } from "@/types"
import { TEMPLATES } from "./_templates"

vi.mock("@/hooks/useFeed", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/useFeed")>()),
  useFeed: vi.fn(),
}))
vi.mock("@/hooks/useMenu", () => ({ useMenu: vi.fn() }))
vi.mock("@/lib/store", () => ({
  readToken: vi.fn().mockResolvedValue("jwt"),
  readLang: vi.fn().mockResolvedValue(null),
  writeLang: vi.fn().mockResolvedValue(undefined),
  readReadItems: vi.fn().mockResolvedValue([]),
  writeReadItems: vi.fn().mockResolvedValue(undefined),
  readNotificationsEnabled: vi.fn().mockResolvedValue(true),
  writeNotificationsEnabled: vi.fn().mockResolvedValue(undefined),
  readLastNotifiedId: vi.fn().mockResolvedValue(null),
  writeLastNotifiedId: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/api", () => ({
  deleteUserRepository: vi.fn().mockResolvedValue(undefined),
  addUserRepository: vi.fn().mockResolvedValue(undefined),
  fetchAuthConfig: vi.fn().mockResolvedValue(null),
  getItemState: vi.fn().mockResolvedValue({ read: [], saved: [] }),
  markItemsRead: vi.fn().mockResolvedValue(undefined),
  setItemSaved: vi.fn().mockResolvedValue(undefined),
  listSavedItems: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue([]),
  setRepositoryFolder: vi.fn().mockResolvedValue(undefined),
}))

const session: AppSession = { userId: "alice", name: "Alice", email: "a@test.com", role: "user" }

function row(
  id: number,
  repo: number,
  provider = "changelog",
): ConnectorItem & { provider: string } {
  return {
    id,
    provider,
    repository_id: repo,
    content: `release ${id}`,
    datetime: `2024-06-${10 + id}T10:00:00Z`,
    executed_at: `2024-06-${10 + id}T10:00:00Z`,
    success: true,
    version: `v${id}.0.0`,
  }
}

function tagged(id: number, repo = 1): TaggedItem {
  const { provider: _provider, ...item } = row(id, repo)
  void _provider
  return { provider: "changelog", item }
}

const fluxes = [
  {
    id: "1",
    repository_id: 1,
    provider: "changelog" as const,
    url: "https://github.com/facebook/react",
    identifier: "facebook/react",
    folder: "AI",
  },
  {
    id: "2",
    repository_id: 2,
    provider: "changelog" as const,
    url: "https://github.com/vercel/next.js",
    identifier: "vercel/next.js",
    folder: null,
  },
]

const connectors = {
  changelog: [row(1, 1), row(2, 2)].map(({ provider: _p, ...i }) => (void _p, i)),
}

function mockFeed(over: Partial<ReturnType<typeof useFeed>> = {}) {
  vi.mocked(useFeed).mockReturnValue({
    fluxes,
    connectors,
    templates: TEMPLATES,
    loading: false,
    error: null,
    refresh: vi.fn(),
    ...over,
  } as ReturnType<typeof useFeed>)
}

function renderLayout() {
  const auth = {
    session,
    token: "jwt",
    loading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    loginOAuth: vi.fn(),
    logout: vi.fn(),
  } as unknown as React.ComponentProps<typeof FeedLayout>["auth"]
  return render(
    <LanguageProvider initialLang="en">
      <ThemeProvider>
        <FeedLayout auth={auth} onCheckUpdates={vi.fn()} />
      </ThemeProvider>
    </LanguageProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getItemState).mockResolvedValue({ read: [], saved: [] })
  vi.mocked(listSavedItems).mockResolvedValue([])
  vi.mocked(searchItems).mockResolvedValue([])
  vi.mocked(readNotificationsEnabled).mockResolvedValue(true)
  vi.mocked(readLastNotifiedId).mockResolvedValue(null)
  vi.mocked(isPermissionGranted).mockResolvedValue(true)
  vi.mocked(requestPermission).mockResolvedValue("granted")
  useNavigationStore.setState({ selection: { type: "all" } })
  useReadItemsStore.setState({
    readIds: new Set(),
    savedIds: new Set(),
    initialized: true,
    ready: true,
    sync: null,
  })
  mockFeed()
})

describe("saved filter", () => {
  it("lists the saved items from the API", async () => {
    vi.mocked(listSavedItems).mockResolvedValue([row(9, 1)])
    const { container } = renderLayout()

    fireEvent.click(screen.getByRole("button", { name: en.feed.filterSaved }))

    await waitFor(() => expect(container.textContent).toContain("v9.0.0"))
    expect(listSavedItems).toHaveBeenCalledWith("alice", "jwt")
    expect(container.querySelectorAll("[data-index]")).toHaveLength(1)
  })

  it("shows an empty list when the saved items cannot be loaded", async () => {
    vi.mocked(listSavedItems).mockRejectedValue(new Error("down"))
    const { container } = renderLayout()

    fireEvent.click(screen.getByRole("button", { name: en.feed.filterSaved }))

    await waitFor(() => expect(container.querySelectorAll("[data-index]")).toHaveLength(0))
  })
})

describe("search", () => {
  it("searches after a pause and replaces the list, then restores it", async () => {
    vi.mocked(searchItems).mockResolvedValue([row(7, 2)])
    const { container } = renderLayout()

    fireEvent.change(screen.getByPlaceholderText(en.feed.searchPlaceholder), {
      target: { value: "rel" },
    })
    await waitFor(() => expect(container.textContent).toContain("v7.0.0"))
    expect(searchItems).toHaveBeenCalledWith("alice", "rel", "jwt")
    expect(container.querySelectorAll("[data-index]")).toHaveLength(1)

    fireEvent.click(screen.getByRole("button", { name: en.feed.clearSearch }))
    await waitFor(() => expect(container.querySelectorAll("[data-index]")).toHaveLength(2))
  })

  it("does not search for one character", async () => {
    renderLayout()
    fireEvent.change(screen.getByPlaceholderText(en.feed.searchPlaceholder), {
      target: { value: "r" },
    })
    await new Promise((r) => setTimeout(r, 400))
    expect(searchItems).not.toHaveBeenCalled()
  })

  it("shows nothing when the search fails", async () => {
    vi.mocked(searchItems).mockRejectedValue(new Error("down"))
    const { container } = renderLayout()
    fireEvent.change(screen.getByPlaceholderText(en.feed.searchPlaceholder), {
      target: { value: "rel" },
    })
    await waitFor(() => expect(container.querySelectorAll("[data-index]")).toHaveLength(0))
  })
})

describe("folders", () => {
  it("shows only the flux of the selected folder", () => {
    useNavigationStore.setState({ selection: { type: "folder", name: "AI" } })
    const { container } = renderLayout()
    expect(container.querySelectorAll("[data-index]")).toHaveLength(1)
  })

  it("lists a folder and moves a flux into one from the sidebar", async () => {
    render(
      <LanguageProvider initialLang="en">
        <FeedSidebar
          fluxes={fluxes}
          templates={TEMPLATES}
          userId="alice"
          token="jwt"
          onRefresh={vi.fn()}
          unreadCountByRepoId={{ 1: 4 }}
        />
      </LanguageProvider>,
    )

    const folder = screen.getByRole("button", { name: /AI/ })
    expect(within(folder).getByText("4")).toBeInTheDocument()
    fireEvent.click(folder)
    expect(useNavigationStore.getState().selection).toEqual({ type: "folder", name: "AI" })

    fireEvent.click(screen.getAllByRole("button", { name: en.feed.moveToFolder })[1])
    fireEvent.change(screen.getByLabelText(en.feed.folderPrompt), {
      target: { value: " Security " },
    })
    fireEvent.click(screen.getByRole("button", { name: en.feed.folderSave }))

    await waitFor(() =>
      expect(setRepositoryFolder).toHaveBeenCalledWith("alice", "2", "Security", "jwt"),
    )
  })

  it("clears a folder with an empty name, and cancels without calling the API", async () => {
    render(
      <LanguageProvider initialLang="en">
        <FeedSidebar
          fluxes={fluxes}
          templates={TEMPLATES}
          userId="alice"
          token="jwt"
          onRefresh={vi.fn()}
        />
      </LanguageProvider>,
    )

    fireEvent.click(screen.getAllByRole("button", { name: en.feed.moveToFolder })[0])
    expect(screen.getByLabelText(en.feed.folderPrompt)).toHaveValue("AI")
    fireEvent.change(screen.getByLabelText(en.feed.folderPrompt), { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: en.feed.folderSave }))
    await waitFor(() => expect(setRepositoryFolder).toHaveBeenCalledWith("alice", "1", null, "jwt"))

    vi.mocked(setRepositoryFolder).mockClear()
    fireEvent.click(screen.getAllByRole("button", { name: en.feed.moveToFolder })[0])
    fireEvent.click(screen.getByRole("button", { name: en.common.cancel }))
    expect(setRepositoryFolder).not.toHaveBeenCalled()
  })
})

describe("save button", () => {
  it("toggles the saved state of the open item", async () => {
    useReadItemsStore.setState({ sync: { userId: "alice", token: "jwt" } })
    render(
      <LanguageProvider initialLang="en">
        <FeedContentViewer
          item={tagged(1)}
          repositories={[{ repository_id: 1, url: "https://github.com/facebook/react" }]}
          templates={TEMPLATES}
        />
      </LanguageProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: en.feed.saveForLater }))

    expect(await screen.findByRole("button", { name: en.feed.removeFromSaved })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(setItemSaved).toHaveBeenCalledWith("alice", 1, true, "jwt")
  })

  it("has none when nothing is open", () => {
    render(
      <LanguageProvider initialLang="en">
        <FeedContentViewer item={null} repositories={[]} templates={TEMPLATES} />
      </LanguageProvider>,
    )
    expect(screen.queryByRole("button", { name: en.feed.saveForLater })).not.toBeInTheDocument()
  })
})

describe("notifications switch", () => {
  it("shows the stored choice and persists a change", async () => {
    vi.mocked(readNotificationsEnabled).mockResolvedValue(false)
    render(
      <LanguageProvider initialLang="en">
        <NotificationsToggle />
      </LanguageProvider>,
    )

    const box = screen.getByRole("checkbox", { name: en.profile.notificationsToggle })
    await waitFor(() => expect(box).not.toBeChecked())
    fireEvent.click(box)

    expect(box).toBeChecked()
    expect(writeNotificationsEnabled).toHaveBeenCalledWith(true)
  })
})

describe("useNewItemNotifications", () => {
  const t = en
  const feed = (...ids: number[]) => ({ changelog: ids.map((id) => tagged(id).item) })

  async function run(conns: Record<string, ConnectorItem[]> | null) {
    const hook = renderHook(({ c }) => useNewItemNotifications(c, t), {
      initialProps: { c: conns },
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    return hook
  }

  it("does not announce the backlog on a first run, only remembers the newest id", async () => {
    vi.mocked(readLastNotifiedId).mockResolvedValue(null)
    await run(feed(1, 2, 3))
    expect(writeLastNotifiedId).toHaveBeenCalledWith(3)
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it("announces unread items newer than the last one notified", async () => {
    vi.mocked(readLastNotifiedId).mockResolvedValue(1)
    await run(feed(1, 2, 3))
    await waitFor(() =>
      expect(sendNotification).toHaveBeenCalledWith({ title: "StayUp", body: "2 new items" }),
    )
    expect(writeLastNotifiedId).toHaveBeenCalledWith(3)
  })

  it("uses the singular for one item", async () => {
    vi.mocked(readLastNotifiedId).mockResolvedValue(1)
    await run(feed(1, 2))
    await waitFor(() =>
      expect(sendNotification).toHaveBeenCalledWith({ title: "StayUp", body: "1 new item" }),
    )
  })

  it("skips what was already read", async () => {
    vi.mocked(readLastNotifiedId).mockResolvedValue(1)
    useReadItemsStore.setState({ readIds: new Set(["changelog:2"]) })
    await run(feed(1, 2))
    expect(sendNotification).not.toHaveBeenCalled()
    expect(writeLastNotifiedId).toHaveBeenCalledWith(2)
  })

  it("says nothing when nothing is newer", async () => {
    vi.mocked(readLastNotifiedId).mockResolvedValue(5)
    await run(feed(1, 2))
    expect(sendNotification).not.toHaveBeenCalled()
    expect(writeLastNotifiedId).not.toHaveBeenCalled()
  })

  it("stays silent when notifications are off, but still moves the marker", async () => {
    vi.mocked(readNotificationsEnabled).mockResolvedValue(false)
    vi.mocked(readLastNotifiedId).mockResolvedValue(1)
    await run(feed(1, 2))
    expect(sendNotification).not.toHaveBeenCalled()
    expect(writeLastNotifiedId).toHaveBeenCalledWith(2)
  })

  it("waits for the server's read state before announcing anything", async () => {
    vi.mocked(readLastNotifiedId).mockResolvedValue(1)
    useReadItemsStore.setState({ ready: false })
    await run(feed(1, 2))
    expect(sendNotification).not.toHaveBeenCalled()
    expect(writeLastNotifiedId).not.toHaveBeenCalled()
  })

  it("does nothing without a feed or with an empty one", async () => {
    await run(null)
    await run({ changelog: [] })
    expect(writeLastNotifiedId).not.toHaveBeenCalled()
  })

  it("asks for the permission when it was not granted yet, and respects a refusal", async () => {
    vi.mocked(readLastNotifiedId).mockResolvedValue(1)
    vi.mocked(isPermissionGranted).mockResolvedValueOnce(false)
    vi.mocked(requestPermission).mockResolvedValueOnce("denied")
    await run(feed(1, 2))
    await waitFor(() => expect(requestPermission).toHaveBeenCalled())
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it("survives the notification service failing", async () => {
    vi.mocked(readLastNotifiedId).mockResolvedValue(1)
    vi.mocked(isPermissionGranted).mockRejectedValueOnce(new Error("no service"))
    await run(feed(1, 2))
    await waitFor(() => expect(isPermissionGranted).toHaveBeenCalled())
    expect(sendNotification).not.toHaveBeenCalled()
  })
})
