import { describe, it, expect, vi, beforeEach } from "vitest"
import { useReadItemsStore, getTaggedItemId } from "@/store/readItems"
import { readReadItems, writeReadItems } from "@/lib/store"
import type { TaggedItem } from "@/types"

vi.mock("@/lib/store", () => ({
  readReadItems: vi.fn().mockResolvedValue([]),
  writeReadItems: vi.fn().mockResolvedValue(undefined),
}))

function taggedItem(provider: TaggedItem["provider"], id: number): TaggedItem {
  return {
    provider,
    item: { id, repository_id: 1, content: "", executed_at: "2024-01-01", success: true },
  } as TaggedItem
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readReadItems).mockResolvedValue([])
  useReadItemsStore.setState({ readIds: new Set(), initialized: false })
})

describe("getTaggedItemId", () => {
  it("builds a provider-scoped id", () => {
    expect(getTaggedItemId(taggedItem("changelog", 42))).toBe("changelog:42")
  })

  it("keeps ids from different providers distinct", () => {
    expect(getTaggedItemId(taggedItem("youtube", 1))).not.toBe(
      getTaggedItemId(taggedItem("rss", 1)),
    )
  })
})

describe("init", () => {
  it("hydrates readIds from the persisted store", async () => {
    vi.mocked(readReadItems).mockResolvedValue(["changelog:1", "rss:2"])
    await useReadItemsStore.getState().init()
    expect([...useReadItemsStore.getState().readIds]).toEqual(["changelog:1", "rss:2"])
    expect(useReadItemsStore.getState().initialized).toBe(true)
  })

  it("is a no-op once already initialized", async () => {
    await useReadItemsStore.getState().init()
    await useReadItemsStore.getState().init()
    expect(readReadItems).toHaveBeenCalledTimes(1)
  })
})

describe("markRead", () => {
  it("adds the id and persists it", async () => {
    await useReadItemsStore.getState().markRead(taggedItem("changelog", 7))
    expect(useReadItemsStore.getState().readIds.has("changelog:7")).toBe(true)
    expect(writeReadItems).toHaveBeenCalledWith(["changelog:7"])
  })

  it("does not persist again when the item is already read", async () => {
    await useReadItemsStore.getState().markRead(taggedItem("changelog", 7))
    await useReadItemsStore.getState().markRead(taggedItem("changelog", 7))
    expect(writeReadItems).toHaveBeenCalledTimes(1)
  })
})

describe("markAllRead", () => {
  it("adds every missing id in a single write", async () => {
    await useReadItemsStore.getState().markAllRead([taggedItem("rss", 1), taggedItem("rss", 2)])

    expect([...useReadItemsStore.getState().readIds]).toEqual(["rss:1", "rss:2"])
    expect(writeReadItems).toHaveBeenCalledTimes(1)
    expect(writeReadItems).toHaveBeenCalledWith(["rss:1", "rss:2"])
  })

  it("is a no-op when nothing is new", async () => {
    useReadItemsStore.setState({ readIds: new Set(["rss:1"]) })
    await useReadItemsStore.getState().markAllRead([taggedItem("rss", 1)])
    expect(writeReadItems).not.toHaveBeenCalled()
  })
})

describe("cleanup", () => {
  it("drops ids that are no longer in the feed", async () => {
    useReadItemsStore.setState({ readIds: new Set(["changelog:1", "rss:2"]) })
    await useReadItemsStore.getState().cleanup(new Set(["changelog:1"]))
    expect([...useReadItemsStore.getState().readIds]).toEqual(["changelog:1"])
    expect(writeReadItems).toHaveBeenCalledWith(["changelog:1"])
  })

  it("does nothing when every stored id is still present", async () => {
    useReadItemsStore.setState({ readIds: new Set(["changelog:1"]) })
    await useReadItemsStore.getState().cleanup(new Set(["changelog:1", "rss:2"]))
    expect(writeReadItems).not.toHaveBeenCalled()
  })
})
