import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useFeed } from "@/hooks/useFeed"
import { getUserFeed, ApiError } from "@/lib/api"

vi.mock("@/lib/api", () => ({
  getUserFeed: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message)
      this.name = "ApiError"
    }
  },
}))

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
  return `eyJhbGciOiJIUzI1NiJ9.${encoded}.sig`
}

const token = makeJwt({ sub: "user-1", exp: Math.floor(Date.now() / 1000) + 3600 })

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
  connectors: {
    changelog: [{ id: 10, repository_id: 1, executed_at: "2024-01-01" }],
    youtube: [],
    rss: [],
    scrap: [],
  },
}

const onAuthError = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getUserFeed).mockResolvedValue(feedResponse as never)
})

describe("useFeed", () => {
  it("loads the feed and labels each flux from its provider template", async () => {
    const { result } = renderHook(() => useFeed(token, onAuthError))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getUserFeed).toHaveBeenCalledWith("user-1", token)
    expect(result.current.fluxes).toEqual([
      expect.objectContaining({
        id: "link-1",
        provider: "changelog",
        identifier: "facebook/react",
      }),
      expect.objectContaining({ id: "link-2", identifier: "@fireship" }),
    ])
    expect(result.current.connectors?.changelog?.[0]).toMatchObject({ id: 10 })
    expect(result.current.error).toBeNull()
  })

  it("renders with the bundled provider templates", async () => {
    const { result } = renderHook(() => useFeed(token, onAuthError))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(Object.keys(result.current.templates).sort()).toEqual([
      "changelog",
      "github_trending",
      "rss",
      "scrap",
      "youtube",
    ])
  })

  it("signs the user out when the API rejects the token", async () => {
    vi.mocked(getUserFeed).mockRejectedValue(new ApiError(401, "Unauthorized"))
    renderHook(() => useFeed(token, onAuthError))

    await waitFor(() => expect(onAuthError).toHaveBeenCalledTimes(1))
  })

  it("reports an error for any other failure", async () => {
    vi.mocked(getUserFeed).mockRejectedValue(new Error("down"))
    const { result } = renderHook(() => useFeed(token, onAuthError))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe("Erreur de chargement.")
    expect(onAuthError).not.toHaveBeenCalled()
  })

  it("handles a repositories-only response (no connectors block, no config)", async () => {
    vi.mocked(getUserFeed).mockResolvedValue({
      repositories: [{ id: "l9", repository_id: 9, url: "https://x.dev", provider: "custom" }],
    } as never)

    const { result } = renderHook(() => useFeed(token, onAuthError))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.connectors).toEqual({})
    expect(result.current.fluxes[0]).toMatchObject({ id: "l9" })
  })

  it("refetches on refresh", async () => {
    const { result } = renderHook(() => useFeed(token, onAuthError))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.refresh()
    })
    expect(getUserFeed).toHaveBeenCalledTimes(2)
  })
})
