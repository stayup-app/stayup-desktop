import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useFeed, needsReconnect } from "@/hooks/useFeed"
import { getUserFeed, getConnectorProviders, ApiError } from "@/lib/api"
import { RAW_PROVIDERS } from "../functional/_templates"
import type { Instance } from "@/lib/store"

vi.mock("@/lib/api", () => ({
  getUserFeed: vi.fn(),
  getConnectorProviders: vi.fn(),
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

function tokenFor(sub: string, offsetSec = 3600): string {
  return makeJwt({ sub, exp: Math.floor(Date.now() / 1000) + offsetSec })
}

function instance(over: Partial<Instance> = {}): Instance {
  return {
    id: "i1",
    url: "https://api.test",
    name: "api.test",
    token: tokenFor("user-1"),
    ...over,
  }
}

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

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getUserFeed).mockResolvedValue(feedResponse as never)
  vi.mocked(getConnectorProviders).mockResolvedValue(RAW_PROVIDERS as never)
})

describe("useFeed", () => {
  it("fans out over a single instance and tags fluxes with it", async () => {
    const { result } = renderHook(() => useFeed([instance()]))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getUserFeed).toHaveBeenCalledWith("user-1", instance().token, "https://api.test")
    expect(result.current.fluxes).toEqual([
      expect.objectContaining({
        id: "link-1",
        provider: "changelog",
        identifier: "facebook/react",
        instanceId: "i1",
        instanceName: "api.test",
      }),
      expect.objectContaining({ id: "link-2", identifier: "@fireship", instanceId: "i1" }),
    ])
    expect(result.current.connectors?.changelog?.[0]).toMatchObject({
      id: 10,
      _instance_id: "i1",
      _instance_name: "api.test",
    })
    expect(result.current.error).toBeNull()
    expect(result.current.instanceErrors).toEqual([])
  })

  it("merges connectors and fluxes across two instances", async () => {
    vi.mocked(getUserFeed)
      .mockResolvedValueOnce(feedResponse as never)
      .mockResolvedValueOnce({
        repositories: [
          {
            id: "link-1",
            repository_id: 1,
            created_at: "",
            url: "https://blog.b.dev",
            provider: "changelog",
            config: {},
          },
        ],
        connectors: { changelog: [{ id: 10, repository_id: 1, executed_at: "2024-02-02" }] },
      } as never)

    const a = instance({ id: "a", name: "A", token: tokenFor("ua") })
    const b = instance({ id: "b", name: "B", url: "https://b.test", token: tokenFor("ub") })
    const { result } = renderHook(() => useFeed([a, b]))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.connectors?.changelog).toHaveLength(2)
    expect(result.current.connectors?.changelog?.map((i) => i._instance_id).sort()).toEqual([
      "a",
      "b",
    ])
    expect(result.current.fluxes.map((f) => f.instanceId).sort()).toEqual(["a", "a", "b"])
  })

  it("completes a template missing on one instance from another", async () => {
    // A returns a bare provider (no template), B returns the same provider fully.
    vi.mocked(getConnectorProviders)
      .mockResolvedValueOnce([{ name: "rss", displayName: "RSS" }] as never)
      .mockResolvedValueOnce(RAW_PROVIDERS as never)
    vi.mocked(getUserFeed).mockResolvedValue({ repositories: [], connectors: {} } as never)

    const a = instance({ id: "a", token: tokenFor("ua") })
    const b = instance({ id: "b", token: tokenFor("ub") })
    const { result } = renderHook(() => useFeed([a, b]))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.templates.rss?.template).toBeTruthy()
  })

  it("tolerates a provider list that fails to load for one instance", async () => {
    vi.mocked(getConnectorProviders)
      .mockRejectedValueOnce(new Error("no providers"))
      .mockResolvedValueOnce(RAW_PROVIDERS as never)
    vi.mocked(getUserFeed).mockResolvedValue({ repositories: [], connectors: {} } as never)

    const a = instance({ id: "a", token: tokenFor("ua") })
    const b = instance({ id: "b", token: tokenFor("ub") })
    const { result } = renderHook(() => useFeed([a, b]))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(result.current.instanceErrors).toEqual([])
  })

  it("keeps other instances when one fails, and lists it as an error", async () => {
    vi.mocked(getUserFeed)
      .mockResolvedValueOnce(feedResponse as never)
      .mockRejectedValueOnce(new Error("down"))

    const a = instance({ id: "a", name: "A", token: tokenFor("ua") })
    const b = instance({ id: "b", name: "B", token: tokenFor("ub") })
    const { result } = renderHook(() => useFeed([a, b]))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.fluxes.map((f) => f.instanceId)).toEqual(["a", "a"])
    expect(result.current.instanceErrors).toEqual([
      { instanceId: "b", instanceName: "B", reason: "unreachable" },
    ])
    expect(result.current.error).toBeNull()
  })

  it("flags a 401 as `auth` (needs reconnection), a plain failure as `unreachable`", async () => {
    vi.mocked(getUserFeed)
      .mockRejectedValueOnce(new ApiError(401, "Unauthorized"))
      .mockRejectedValueOnce(new Error("network"))

    const a = instance({ id: "a", name: "A", token: tokenFor("ua") })
    const b = instance({ id: "b", name: "B", token: tokenFor("ub") })
    const { result } = renderHook(() => useFeed([a, b]))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.instanceErrors).toEqual([
      { instanceId: "a", instanceName: "A", reason: "auth" },
      { instanceId: "b", instanceName: "B", reason: "unreachable" },
    ])
    expect(needsReconnect(result.current.instanceErrors).map((e) => e.instanceId)).toEqual(["a"])
  })

  it("flags an error only when every live instance fails", async () => {
    vi.mocked(getUserFeed).mockRejectedValue(new Error("down"))
    const { result } = renderHook(() => useFeed([instance()]))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe("Erreur de chargement.")
    expect(result.current.connectors).toBeNull()
  })

  it("does not fetch an expired instance but reports it", async () => {
    const { result } = renderHook(() => useFeed([instance({ token: tokenFor("user-1", -10) })]))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getUserFeed).not.toHaveBeenCalled()
    expect(result.current.instanceErrors).toEqual([
      { instanceId: "i1", instanceName: "api.test", reason: "expired" },
    ])
    expect(needsReconnect(result.current.instanceErrors)).toHaveLength(1)
  })

  it("handles a repositories-only response (no connectors block, no config, no template)", async () => {
    vi.mocked(getConnectorProviders).mockResolvedValue([] as never)
    vi.mocked(getUserFeed).mockResolvedValue({
      repositories: [{ id: "l9", repository_id: 9, url: "https://x.dev", provider: "custom" }],
    } as never)

    const { result } = renderHook(() => useFeed([instance()]))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.connectors).toEqual({})
    expect(result.current.fluxes[0]).toMatchObject({ id: "l9", instanceId: "i1" })
  })

  it("refetches on refresh", async () => {
    const { result } = renderHook(() => useFeed([instance()]))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      result.current.refresh()
    })
    expect(getUserFeed).toHaveBeenCalledTimes(2)
  })

  it("reloads when the instance list changes", async () => {
    const { result, rerender } = renderHook(({ list }) => useFeed(list), {
      initialProps: { list: [instance({ id: "a", token: tokenFor("ua") })] },
    })
    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender({ list: [instance({ id: "a", token: tokenFor("ua2") })] })
    await waitFor(() => expect(getUserFeed).toHaveBeenCalledTimes(2))
  })
})
