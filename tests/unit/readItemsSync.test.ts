import { describe, it, expect, vi, beforeEach } from "vitest"
import { useReadItemsStore } from "@/store/readItems"
import { readReadItems, writeReadItems } from "@/lib/store"
import { getItemState, markItemsRead, setItemSaved } from "@/lib/api"
import type { TaggedItem } from "@/types"

vi.mock("@/lib/store", () => ({
  readReadItems: vi.fn().mockResolvedValue([]),
  writeReadItems: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/api", () => ({
  getItemState: vi.fn(),
  markItemsRead: vi.fn().mockResolvedValue(undefined),
  setItemSaved: vi.fn().mockResolvedValue(undefined),
}))

const SYNC = { userId: "u1", token: "jwt" }

function tagged(id: number, provider = "rss"): TaggedItem {
  return {
    provider,
    item: { id, repository_id: 1, content: "", executed_at: "2024-01-01", success: true },
  } as TaggedItem
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readReadItems).mockResolvedValue([])
  vi.mocked(getItemState).mockResolvedValue({ read: [], saved: [] })
  useReadItemsStore.setState({
    readIds: new Set(),
    savedIds: new Set(),
    initialized: false,
    ready: false,
    sync: null,
  })
})

describe("init with the server", () => {
  it("adopts the server's read and saved items", async () => {
    vi.mocked(getItemState).mockResolvedValue({ read: ["rss:7"], saved: ["rss:9"] })
    await useReadItemsStore.getState().init(SYNC)

    const state = useReadItemsStore.getState()
    expect([...state.readIds]).toEqual(["rss:7"])
    expect([...state.savedIds]).toEqual(["rss:9"])
    expect(state.ready).toBe(true)
    expect(writeReadItems).toHaveBeenCalledWith(["rss:7"])
  })

  it("uploads what only this device had read, and keeps both", async () => {
    vi.mocked(readReadItems).mockResolvedValue(["rss:1", "rss:7"])
    vi.mocked(getItemState).mockResolvedValue({ read: ["rss:7"], saved: [] })
    await useReadItemsStore.getState().init(SYNC)

    expect([...useReadItemsStore.getState().readIds].sort()).toEqual(["rss:1", "rss:7"])
    expect(markItemsRead).toHaveBeenCalledWith("u1", [1], "jwt")
  })

  it("uploads in batches of 1000", async () => {
    const local = Array.from({ length: 2500 }, (_, i) => `rss:${i + 1}`)
    vi.mocked(readReadItems).mockResolvedValue(local)
    await useReadItemsStore.getState().init(SYNC)

    const sizes = vi.mocked(markItemsRead).mock.calls.map((c) => c[1].length)
    expect(sizes).toEqual([1000, 1000, 500])
  })

  it("keeps the local copy when the server is unreachable", async () => {
    vi.mocked(readReadItems).mockResolvedValue(["rss:5"])
    vi.mocked(getItemState).mockRejectedValue(new Error("offline"))
    await useReadItemsStore.getState().init(SYNC)

    expect([...useReadItemsStore.getState().readIds]).toEqual(["rss:5"])
    expect(useReadItemsStore.getState().ready).toBe(true)
  })

  it("stays local, and ready, without credentials", async () => {
    vi.mocked(readReadItems).mockResolvedValue(["rss:5"])
    await useReadItemsStore.getState().init()

    expect(getItemState).not.toHaveBeenCalled()
    expect(useReadItemsStore.getState().ready).toBe(true)
  })
})

describe("syncing marks", () => {
  beforeEach(async () => {
    await useReadItemsStore.getState().init(SYNC)
    vi.mocked(markItemsRead).mockClear()
  })

  it("tells the server an item is read, once", async () => {
    await useReadItemsStore.getState().markRead(tagged(3))
    await useReadItemsStore.getState().markRead(tagged(3))
    expect(markItemsRead).toHaveBeenCalledTimes(1)
    expect(markItemsRead).toHaveBeenCalledWith("u1", [3], "jwt")
  })

  it("sends only the items that were not read yet when marking all", async () => {
    await useReadItemsStore.getState().markRead(tagged(1))
    vi.mocked(markItemsRead).mockClear()
    await useReadItemsStore.getState().markAllRead([tagged(1), tagged(2), tagged(3)])
    expect(markItemsRead).toHaveBeenCalledWith("u1", [2, 3], "jwt")
  })

  it("survives the server rejecting a mark", async () => {
    vi.mocked(markItemsRead).mockRejectedValue(new Error("500"))
    await useReadItemsStore.getState().markRead(tagged(4))
    expect(useReadItemsStore.getState().readIds.has("rss:4")).toBe(true)
  })

  it("saves and unsaves an item through the API", async () => {
    await useReadItemsStore.getState().toggleSaved(tagged(8))
    expect(useReadItemsStore.getState().savedIds.has("rss:8")).toBe(true)
    expect(setItemSaved).toHaveBeenLastCalledWith("u1", 8, true, "jwt")

    await useReadItemsStore.getState().toggleSaved(tagged(8))
    expect(useReadItemsStore.getState().savedIds.has("rss:8")).toBe(false)
    expect(setItemSaved).toHaveBeenLastCalledWith("u1", 8, false, "jwt")
  })

  it("survives the server rejecting a save", async () => {
    vi.mocked(setItemSaved).mockRejectedValue(new Error("500"))
    await useReadItemsStore.getState().toggleSaved(tagged(8))
    expect(useReadItemsStore.getState().savedIds.has("rss:8")).toBe(true)
  })
})

describe("without credentials", () => {
  it("saves locally and calls nothing", async () => {
    await useReadItemsStore.getState().init()
    await useReadItemsStore.getState().markRead(tagged(1))
    await useReadItemsStore.getState().toggleSaved(tagged(2))

    expect(markItemsRead).not.toHaveBeenCalled()
    expect(setItemSaved).not.toHaveBeenCalled()
    expect(useReadItemsStore.getState().savedIds.has("rss:2")).toBe(true)
  })
})
