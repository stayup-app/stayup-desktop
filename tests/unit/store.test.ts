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
const { readToken, writeToken, clearToken, readLang, writeLang, readReadItems, writeReadItems } =
  await import("@/lib/store")

/** Route store reads by key so a test can stage a full settings blob. */
function stageStore(values: Record<string, unknown>) {
  get.mockImplementation((key: string) => Promise.resolve(values[key] ?? null))
}

beforeEach(() => {
  get.mockReset()
  set.mockReset()
  del.mockReset()
  get.mockResolvedValue(null)
})

describe("token", () => {
  it("reads the stored token", async () => {
    stageStore({ auth_token: "jwt-a" })
    await expect(readToken()).resolves.toBe("jwt-a")
    expect(get).toHaveBeenCalledWith("auth_token")
  })

  it("returns null when nothing is stored", async () => {
    await expect(readToken()).resolves.toBeNull()
  })

  it("carries over the first session of a multi-server version, then drops its keys", async () => {
    stageStore({
      instances: [
        { id: "i1", url: "https://a.example.com", name: "a", token: "jwt-first" },
        { id: "i2", url: "https://b.example.com", name: "b", token: "jwt-second" },
      ],
    })
    await expect(readToken()).resolves.toBe("jwt-first")
    expect(set).toHaveBeenCalledWith("auth_token", "jwt-first")
    expect(del).toHaveBeenCalledWith("instances")
    expect(del).toHaveBeenCalledWith("api_url")
  })

  it("drops an obsolete empty server list without inventing a session", async () => {
    stageStore({ instances: [] })
    await expect(readToken()).resolves.toBeNull()
    expect(set).not.toHaveBeenCalled()
    expect(del).toHaveBeenCalledWith("instances")
  })

  it("writes the token", async () => {
    await writeToken("jwt-new")
    expect(set).toHaveBeenCalledWith("auth_token", "jwt-new")
  })

  it("clears the token on logout", async () => {
    await clearToken()
    expect(del).toHaveBeenCalledWith("auth_token")
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
    await readLang()
    expect(vi.mocked(load).mock.calls.length).toBe(callsBefore)
  })
})
