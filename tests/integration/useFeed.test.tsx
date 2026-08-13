import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useFeed } from "@/hooks/useFeed"
import { getUserFeed } from "@/lib/api"
import { readToken, readApiUrl } from "@/lib/store"

vi.mock("@/lib/api", () => ({ getUserFeed: vi.fn() }))
vi.mock("@/lib/store", () => ({
  readToken: vi.fn(),
  readApiUrl: vi.fn().mockResolvedValue("https://api.test"),
}))

const feedResponse = {
  repositories: [
    {
      id: "link-1",
      repository_id: 1,
      created_at: "2024-01-01",
      url: "https://github.com/facebook/react",
      provider: "changelog" as const,
      config: {},
    },
    {
      id: "link-2",
      repository_id: 2,
      created_at: "2024-01-01",
      url: "https://www.youtube.com/@fireship",
      provider: "youtube" as const,
      config: {},
    },
  ],
  connectors: { changelog: [], youtube: [], rss: [], scrap: [] },
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readToken).mockResolvedValue("jwt")
  vi.mocked(readApiUrl).mockResolvedValue("https://api.test")
  vi.mocked(getUserFeed).mockResolvedValue(feedResponse)
})

describe("useFeed", () => {
  it("loads the feed and derives an identifier per repository", async () => {
    const { result } = renderHook(() => useFeed("user-1"))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getUserFeed).toHaveBeenCalledWith("user-1", "jwt", "https://api.test")
    expect(result.current.fluxes).toEqual([
      {
        id: "link-1",
        repository_id: 1,
        provider: "changelog",
        url: "https://github.com/facebook/react",
        identifier: "facebook/react",
      },
      {
        id: "link-2",
        repository_id: 2,
        provider: "youtube",
        url: "https://www.youtube.com/@fireship",
        identifier: "@fireship",
      },
    ])
    expect(result.current.connectors).toEqual(feedResponse.connectors)
    expect(result.current.error).toBeNull()
  })

  it("reports a missing token as an error", async () => {
    vi.mocked(readToken).mockResolvedValue(null)
    const { result } = renderHook(() => useFeed("user-1"))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe("Token manquant")
    expect(getUserFeed).not.toHaveBeenCalled()
  })

  it("surfaces the API error message", async () => {
    vi.mocked(getUserFeed).mockRejectedValue(new Error("StayUp API error 500"))
    const { result } = renderHook(() => useFeed("user-1"))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe("StayUp API error 500")
  })

  it("falls back to a generic message for a non-Error rejection", async () => {
    vi.mocked(getUserFeed).mockRejectedValue("boom")
    const { result } = renderHook(() => useFeed("user-1"))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe("Erreur de chargement.")
  })

  it("refetches on refresh", async () => {
    const { result } = renderHook(() => useFeed("user-1"))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.refresh()
    })

    expect(getUserFeed).toHaveBeenCalledTimes(2)
  })

  it("reloads when the user id changes", async () => {
    const { result, rerender } = renderHook(({ id }) => useFeed(id), {
      initialProps: { id: "user-1" },
    })
    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender({ id: "user-2" })
    await waitFor(() => expect(getUserFeed).toHaveBeenCalledTimes(2))
    expect(getUserFeed).toHaveBeenLastCalledWith("user-2", "jwt", "https://api.test")
  })
})
