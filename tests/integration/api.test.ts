import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  loginWithPassword,
  registerWithPassword,
  updateProfile,
  getUserFeed,
  addUserRepository,
  deleteUserRepository,
  getScrapRepos,
  subscribeScrap,
  unsubscribeScrap,
  createScrapRequest,
} from "@/lib/api"

const API_URL = "https://api.example.com"
const TOKEN = "test-token"

beforeEach(() => {
  vi.restoreAllMocks()
})

describe("loginWithPassword", () => {
  it("returns the token string on successful login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ token: "jwt-abc-123" }),
      }),
    )
    const token = await loginWithPassword("user@test.com", "pass123", API_URL)
    expect(token).toBe("jwt-abc-123")
  })

  it("throws 'Identifiants invalides.' on 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    await expect(loginWithPassword("bad@test.com", "wrong", API_URL)).rejects.toThrow(
      "Identifiants invalides.",
    )
  })

  it("throws 'Erreur serveur' on 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(loginWithPassword("u@test.com", "pass", API_URL)).rejects.toThrow(
      "Erreur serveur, réessayez.",
    )
  })

  it("strips trailing slash from apiUrl before calling the endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: "t" }),
    })
    vi.stubGlobal("fetch", fetchMock)
    await loginWithPassword("u@test.com", "pass", "https://api.example.com/")
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/auth/login", expect.anything())
  })
})

describe("registerWithPassword", () => {
  it("returns the token string on successful registration", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ token: "jwt-new-1" }),
      }),
    )
    const token = await registerWithPassword("Alice", "alice@test.com", "pass1234", API_URL)
    expect(token).toBe("jwt-new-1")
  })

  it("throws 'Un compte existe déjà avec cet email.' on 409", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409 }))
    await expect(
      registerWithPassword("Alice", "taken@test.com", "pass1234", API_URL),
    ).rejects.toThrow("Un compte existe déjà avec cet email.")
  })

  it("throws 'Erreur serveur' on 5xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(registerWithPassword("Alice", "a@test.com", "pass1234", API_URL)).rejects.toThrow(
      "Erreur serveur, réessayez.",
    )
  })
})

describe("updateProfile", () => {
  it("PATCHes the profile payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)

    await updateProfile("user-1", TOKEN, API_URL, { email: "new@test.com" })

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/ui/users/user-1`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ email: "new@test.com" }),
      }),
    )
  })
})

describe("getUserFeed", () => {
  it("fetches feed data and includes the bearer token", async () => {
    const mockData = {
      repositories: [],
      connectors: { changelog: [], youtube: [], rss: [], scrap: [] },
    }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => mockData })
    vi.stubGlobal("fetch", fetchMock)

    const data = await getUserFeed("user-1", TOKEN, API_URL)
    expect(data).toEqual(mockData)
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/ui/users/user-1/feed`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    )
  })

  it("retries once on a 5xx error and succeeds", async () => {
    const mockData = {
      repositories: [],
      connectors: { changelog: [], youtube: [], rss: [], scrap: [] },
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: async () => mockData })
    vi.stubGlobal("fetch", fetchMock)

    await getUserFeed("user-1", TOKEN, API_URL)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("throws after the second 5xx (no more retries)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(getUserFeed("user-1", TOKEN, API_URL)).rejects.toThrow("StayUp API error 500")
  })

  it("retries once on a network TypeError", async () => {
    const mockData = {
      repositories: [],
      connectors: { changelog: [], youtube: [], rss: [], scrap: [] },
    }
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Network error"))
      .mockResolvedValueOnce({ ok: true, json: async () => mockData })
    vi.stubGlobal("fetch", fetchMock)

    await getUserFeed("user-1", TOKEN, API_URL)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe("addUserRepository", () => {
  it("POSTs the repository payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)

    await addUserRepository("user-1", TOKEN, API_URL, {
      provider: "changelog",
      url: "https://github.com/facebook/react/",
      config: { max_scraps: 5 },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/ui/users/user-1/repositories`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          provider: "changelog",
          url: "https://github.com/facebook/react/",
          config: { max_scraps: 5 },
        }),
      }),
    )
  })
})

describe("deleteUserRepository", () => {
  it("DELETEs the link id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal("fetch", fetchMock)

    await deleteUserRepository("user-1", "link-9", TOKEN, API_URL)

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/ui/users/user-1/repositories/link-9`,
      expect.objectContaining({ method: "DELETE" }),
    )
  })
})

describe("scrap endpoints", () => {
  it("getScrapRepos unwraps the repos array", async () => {
    const repos = [
      { id: 1, url: "https://example.com", config: {}, created_at: "", is_subscribed: false },
    ]
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ repos }) }))
    await expect(getScrapRepos(TOKEN, API_URL)).resolves.toEqual(repos)
  })

  it("subscribeScrap POSTs to the subscribe endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal("fetch", fetchMock)
    await subscribeScrap(3, TOKEN, API_URL)
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/scrap/3/subscribe`,
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("unsubscribeScrap DELETEs the subscribe endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal("fetch", fetchMock)
    await unsubscribeScrap(3, TOKEN, API_URL)
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/scrap/3/subscribe`,
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("createScrapRequest POSTs the url and returns the created id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "req-1" }) })
    vi.stubGlobal("fetch", fetchMock)

    await expect(createScrapRequest({ url: "https://blog.dev" }, TOKEN, API_URL)).resolves.toEqual({
      id: "req-1",
    })
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/scrap/requests`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ url: "https://blog.dev" }),
      }),
    )
  })
})

describe("apiFetch error handling", () => {
  it("does not retry on a 4xx error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 })
    vi.stubGlobal("fetch", fetchMock)
    await expect(getUserFeed("user-1", TOKEN, API_URL)).rejects.toThrow("StayUp API error 404")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not retry on a non-network error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("boom"))
    vi.stubGlobal("fetch", fetchMock)
    await expect(getUserFeed("user-1", TOKEN, API_URL)).rejects.toThrow("boom")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("rethrows when the retry also fails with a network error", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Network error"))
    vi.stubGlobal("fetch", fetchMock)
    await expect(getUserFeed("user-1", TOKEN, API_URL)).rejects.toThrow("Network error")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
