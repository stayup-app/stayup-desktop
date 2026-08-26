import { describe, it, expect, vi, beforeEach } from "vitest"
import { load } from "@tauri-apps/plugin-store"

const get = vi.fn()
const set = vi.fn()
const del = vi.fn()

vi.mocked(load).mockResolvedValue({
  get,
  set,
  delete: del,
} as unknown as Awaited<ReturnType<typeof load>>)

// Imported after the mock is wired so the module-level store cache uses it
const {
  readToken,
  writeToken,
  clearToken,
  readApiUrl,
  writeApiUrl,
  resetApiUrl,
  readLang,
  writeLang,
  readReadItems,
  writeReadItems,
} = await import("@/lib/store")

const DEFAULT_API_URL = "https://stayup-api.r-sik.workers.dev"

beforeEach(() => {
  get.mockReset()
  set.mockReset()
  del.mockReset()
  get.mockResolvedValue(null)
})

describe("token", () => {
  it("reads the stored token", async () => {
    get.mockResolvedValue("jwt-123")
    await expect(readToken()).resolves.toBe("jwt-123")
    expect(get).toHaveBeenCalledWith("auth_token")
  })

  it("returns null when no token is stored", async () => {
    get.mockResolvedValue(undefined)
    await expect(readToken()).resolves.toBeNull()
  })

  it("writes the token", async () => {
    await writeToken("jwt-456")
    expect(set).toHaveBeenCalledWith("auth_token", "jwt-456")
  })

  it("clears the token", async () => {
    await clearToken()
    expect(del).toHaveBeenCalledWith("auth_token")
  })
})

describe("readApiUrl", () => {
  it("returns the stored API URL", async () => {
    get.mockResolvedValue("https://api.custom.dev")
    await expect(readApiUrl()).resolves.toBe("https://api.custom.dev")
  })

  it("falls back to the default API URL", async () => {
    get.mockResolvedValue(null)
    await expect(readApiUrl()).resolves.toBe(DEFAULT_API_URL)
  })

  it("writes the API URL", async () => {
    await writeApiUrl("https://api.custom.dev")
    expect(set).toHaveBeenCalledWith("api_url", "https://api.custom.dev")
  })

  it("drops the override so the default applies again", async () => {
    await resetApiUrl()
    expect(del).toHaveBeenCalledWith("api_url")
  })
})

describe("lang", () => {
  it("reads the stored language", async () => {
    get.mockResolvedValue("en")
    await expect(readLang()).resolves.toBe("en")
    expect(get).toHaveBeenCalledWith("lang")
  })

  it("returns null when no language is stored", async () => {
    get.mockResolvedValue(null)
    await expect(readLang()).resolves.toBeNull()
  })

  it("writes the language", async () => {
    await writeLang("fr")
    expect(set).toHaveBeenCalledWith("lang", "fr")
  })
})

describe("read items", () => {
  it("reads the stored id list", async () => {
    get.mockResolvedValue(["changelog:1", "rss:2"])
    await expect(readReadItems()).resolves.toEqual(["changelog:1", "rss:2"])
    expect(get).toHaveBeenCalledWith("read_items")
  })

  it("returns an empty array when nothing is stored", async () => {
    get.mockResolvedValue(null)
    await expect(readReadItems()).resolves.toEqual([])
  })

  it("writes the id list", async () => {
    await writeReadItems(["youtube:9"])
    expect(set).toHaveBeenCalledWith("read_items", ["youtube:9"])
  })
})

describe("store instance caching", () => {
  it("loads the store file only once across calls", async () => {
    const callsBefore = vi.mocked(load).mock.calls.length
    await readToken()
    await readApiUrl()
    await readLang()
    expect(vi.mocked(load).mock.calls.length).toBe(callsBefore)
  })
})
