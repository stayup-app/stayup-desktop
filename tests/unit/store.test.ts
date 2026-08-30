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
  readInstances,
  writeInstances,
  addInstance,
  removeInstance,
  renameInstance,
  setPrimaryInstance,
  updateInstanceToken,
  upsertPrimaryInstance,
  hostOf,
  readLang,
  writeLang,
  readReadItems,
  writeReadItems,
  DEFAULT_API_URL,
} = await import("@/lib/store")

/** Route store reads by key so a test can stage a full settings blob. */
function stageStore(values: Record<string, unknown>) {
  get.mockImplementation((key: string) => Promise.resolve(values[key] ?? null))
}

/** The value of the most recent store.set(...) call. */
function lastSet(): unknown {
  const calls = set.mock.calls
  return calls[calls.length - 1]?.[1]
}

const INST = { id: "i1", url: "https://a.example.com", name: "a", token: "jwt-a" }

beforeEach(() => {
  get.mockReset()
  set.mockReset()
  del.mockReset()
  get.mockResolvedValue(null)
})

describe("instances", () => {
  it("reads the stored instance list", async () => {
    stageStore({ instances: [INST] })
    await expect(readInstances()).resolves.toEqual([INST])
    expect(get).toHaveBeenCalledWith("instances")
  })

  it("returns an empty list when nothing is stored and there is no legacy session", async () => {
    await expect(readInstances()).resolves.toEqual([])
  })

  it("migrates a legacy auth_token + api_url into a primary instance", async () => {
    stageStore({ auth_token: "legacy-jwt", api_url: "https://legacy.example.com" })
    const list = await readInstances()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      url: "https://legacy.example.com",
      name: "legacy.example.com",
      token: "legacy-jwt",
    })
    expect(list[0].id).toBeTruthy()
    // The blob is persisted and the legacy keys are dropped.
    expect(set).toHaveBeenCalledWith("instances", list)
    expect(del).toHaveBeenCalledWith("auth_token")
    expect(del).toHaveBeenCalledWith("api_url")
  })

  it("migrates with the default URL when only a legacy token exists", async () => {
    stageStore({ auth_token: "legacy-jwt" })
    const list = await readInstances()
    expect(list[0].url).toBe(DEFAULT_API_URL)
  })

  it("appends a secondary instance", async () => {
    stageStore({ instances: [INST] })
    await addInstance({ url: "https://b.example.com", name: "b", token: "jwt-b" })
    const written = lastSet() as unknown[]
    expect(written).toHaveLength(2)
    expect(written[1]).toMatchObject({ url: "https://b.example.com", name: "b", token: "jwt-b" })
  })

  it("removes an instance by id", async () => {
    stageStore({ instances: [INST, { ...INST, id: "i2" }] })
    const next = await removeInstance("i2")
    expect(next).toEqual([INST])
  })

  it("renames an instance", async () => {
    stageStore({ instances: [INST] })
    await renameInstance("i1", "Renamed")
    expect(lastSet()).toEqual([{ ...INST, name: "Renamed" }])
  })

  it("promotes an instance to primary by moving it to the front", async () => {
    const second = { ...INST, id: "i2", token: "jwt-2" }
    stageStore({ instances: [INST, second] })
    await setPrimaryInstance("i2")
    expect(lastSet()).toEqual([second, INST])
  })

  it("updates a single instance's token", async () => {
    stageStore({ instances: [INST] })
    await updateInstanceToken("i1", "fresh")
    expect(lastSet()).toEqual([{ ...INST, token: "fresh" }])
  })

  it("writes a list verbatim", async () => {
    await writeInstances([INST])
    expect(set).toHaveBeenCalledWith("instances", [INST])
  })

  it("treats a stored empty list as no instances (still migrates a legacy session)", async () => {
    stageStore({ instances: [], auth_token: "legacy-jwt" })
    const list = await readInstances()
    expect(list).toHaveLength(1)
    expect(list[0].token).toBe("legacy-jwt")
  })

  it("ignores setPrimary for an unknown id", async () => {
    stageStore({ instances: [INST] })
    set.mockClear()
    await setPrimaryInstance("nope")
    expect(set).not.toHaveBeenCalled()
  })

  it("ignores updateInstanceToken for an unknown id", async () => {
    stageStore({ instances: [INST] })
    await updateInstanceToken("nope", "x")
    expect(lastSet()).toEqual([INST])
  })
})

describe("upsertPrimaryInstance", () => {
  it("creates a primary from scratch, naming it after the host", async () => {
    const inst = await upsertPrimaryInstance({ url: "https://c.example.com", token: "t" })
    expect(inst).toMatchObject({ url: "https://c.example.com", name: "c.example.com", token: "t" })
    expect(inst.id).toBeTruthy()
  })

  it("keeps the existing id and honours an explicit name", async () => {
    stageStore({ instances: [INST] })
    const inst = await upsertPrimaryInstance({ url: INST.url, token: "t2", name: "Home" })
    expect(inst).toEqual({ id: "i1", url: INST.url, name: "Home", token: "t2" })
  })
})

describe("hostOf", () => {
  it("returns the host of a valid URL", () => {
    expect(hostOf("https://api.example.com:8080/x")).toBe("api.example.com:8080")
  })

  it("returns the input unchanged when it is not a URL", () => {
    expect(hostOf("not a url")).toBe("not a url")
  })
})

describe("token (primary-instance compat)", () => {
  it("reads the primary instance token", async () => {
    stageStore({ instances: [INST] })
    await expect(readToken()).resolves.toBe("jwt-a")
  })

  it("returns null when there is no instance", async () => {
    await expect(readToken()).resolves.toBeNull()
  })

  it("upserts the primary instance token, keeping its URL", async () => {
    stageStore({ instances: [INST] })
    await writeToken("jwt-new")
    expect(lastSet()).toEqual([{ ...INST, token: "jwt-new" }])
  })

  it("clears every instance on logout", async () => {
    await clearToken()
    expect(del).toHaveBeenCalledWith("instances")
  })
})

describe("readApiUrl (primary-instance compat)", () => {
  it("returns the primary instance URL", async () => {
    stageStore({ instances: [INST] })
    await expect(readApiUrl()).resolves.toBe("https://a.example.com")
  })

  it("falls back to the default API URL", async () => {
    await expect(readApiUrl()).resolves.toBe(DEFAULT_API_URL)
  })

  it("writes the primary instance URL", async () => {
    stageStore({ instances: [INST] })
    await writeApiUrl("https://api.custom.dev")
    expect(lastSet()).toEqual([{ ...INST, url: "https://api.custom.dev" }])
  })

  it("creates a tokenless primary instance when none exists yet", async () => {
    await writeApiUrl("https://api.custom.dev")
    const written = lastSet() as { url: string; token: string }[]
    expect(written[0]).toMatchObject({ url: "https://api.custom.dev", token: "" })
  })

  it("resets the primary instance URL to the default", async () => {
    stageStore({ instances: [INST] })
    await resetApiUrl()
    expect(lastSet()).toEqual([{ ...INST, url: DEFAULT_API_URL }])
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
    get.mockResolvedValue(["i1:changelog:1", "i1:rss:2"])
    await expect(readReadItems()).resolves.toEqual(["i1:changelog:1", "i1:rss:2"])
    expect(get).toHaveBeenCalledWith("read_items")
  })

  it("returns an empty array when nothing is stored", async () => {
    get.mockResolvedValue(null)
    await expect(readReadItems()).resolves.toEqual([])
  })

  it("writes the id list", async () => {
    await writeReadItems(["i1:youtube:9"])
    expect(set).toHaveBeenCalledWith("read_items", ["i1:youtube:9"])
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
