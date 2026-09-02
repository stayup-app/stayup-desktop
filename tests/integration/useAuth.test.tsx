import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { useAuth } from "@/hooks/useAuth"
import {
  readInstances,
  upsertPrimaryInstance,
  addInstance,
  removeInstance,
  renameInstance,
  setPrimaryInstance,
  updateInstanceToken,
  clearInstances,
  readApiUrl,
} from "@/lib/store"
import { ApiError, loginWithPassword, registerWithPassword, fetchAuthConfig } from "@/lib/api"
import { LanguageProvider } from "@/context/LanguageContext"
import { en } from "@/lib/translations"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }))
vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      readonly status: number,
      message: string,
    ) {
      super(message)
      this.name = "ApiError"
    }
  },
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  fetchAuthConfig: vi.fn().mockResolvedValue(null),
}))
vi.mock("@/lib/store", () => ({
  readInstances: vi.fn().mockResolvedValue([]),
  writeInstances: vi.fn().mockResolvedValue(undefined),
  upsertPrimaryInstance: vi.fn().mockResolvedValue(undefined),
  addInstance: vi.fn().mockResolvedValue(undefined),
  removeInstance: vi.fn().mockResolvedValue(undefined),
  renameInstance: vi.fn().mockResolvedValue(undefined),
  setPrimaryInstance: vi.fn().mockResolvedValue(undefined),
  updateInstanceToken: vi.fn().mockResolvedValue(undefined),
  clearInstances: vi.fn().mockResolvedValue(undefined),
  readApiUrl: vi.fn().mockResolvedValue("https://api.test"),
  hostOf: (u: string) => u,
  readLang: vi.fn().mockResolvedValue(null),
  writeLang: vi.fn().mockResolvedValue(undefined),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>
}

function renderAuth() {
  return renderHook(() => useAuth(), { wrapper })
}

function makeJwt(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
  return `eyJhbGciOiJIUzI1NiJ9.${encoded}.signature`
}

const validToken = makeJwt({
  sub: "u1",
  name: "Alice",
  email: "alice@test.com",
  role: "user",
  exp: Math.floor(Date.now() / 1000) + 3600,
})
const expiredToken = makeJwt({ sub: "u1", exp: Math.floor(Date.now() / 1000) - 10 })

function instance(over: Record<string, unknown> = {}) {
  return { id: "i1", url: "https://api.test", name: "api.test", token: validToken, ...over }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readInstances).mockResolvedValue([])
  vi.mocked(readApiUrl).mockResolvedValue("https://api.test")
  vi.mocked(listen).mockResolvedValue(vi.fn())
  vi.mocked(fetchAuthConfig).mockResolvedValue(null)
})

describe("initial session restore", () => {
  it("restores the primary session from a stored instance", async () => {
    vi.mocked(readInstances).mockResolvedValue([instance()])
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toMatchObject({
      userId: "u1",
      email: "alice@test.com",
      instanceId: "i1",
      instanceName: "api.test",
      expired: false,
    })
  })

  it("still exposes an expired primary session, flagged as expired", async () => {
    vi.mocked(readInstances).mockResolvedValue([instance({ token: expiredToken })])
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session?.expired).toBe(true)
  })

  it("stays signed out when there is no instance", async () => {
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
    expect(result.current.sessions).toEqual([])
  })
})

describe("login", () => {
  it("upserts the primary instance and exposes the decoded session", async () => {
    vi.mocked(loginWithPassword).mockResolvedValue(validToken)
    vi.mocked(readInstances).mockResolvedValueOnce([]).mockResolvedValue([instance()])
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.login("alice@test.com", "pass"))

    expect(loginWithPassword).toHaveBeenCalledWith("alice@test.com", "pass", "https://api.test")
    expect(upsertPrimaryInstance).toHaveBeenCalledWith({
      url: "https://api.test",
      token: validToken,
    })
    expect(result.current.session?.email).toBe("alice@test.com")
  })

  it("translates a 401 instead of showing the API message", async () => {
    vi.mocked(loginWithPassword).mockRejectedValue(new ApiError(401, "Invalid credentials"))
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.login("bad@test.com", "wrong"))

    expect(result.current.error).toBe(en.errors.invalidCredentials)
    expect(result.current.session).toBeNull()
  })

  it("falls back to a generic message for any other rejection", async () => {
    vi.mocked(loginWithPassword).mockRejectedValue("nope")
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.login("a@b.c", "x"))

    expect(result.current.error).toBe(en.errors.serverError)
  })
})

describe("register", () => {
  it("upserts the primary instance and exposes the decoded session", async () => {
    vi.mocked(registerWithPassword).mockResolvedValue({ token: validToken })
    vi.mocked(readInstances).mockResolvedValueOnce([]).mockResolvedValue([instance()])
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.register("Alice", "alice@test.com", "pass1234"))

    expect(registerWithPassword).toHaveBeenCalledWith(
      "Alice",
      "alice@test.com",
      "pass1234",
      "https://api.test",
    )
    expect(upsertPrimaryInstance).toHaveBeenCalledWith({
      url: "https://api.test",
      token: validToken,
    })
    expect(result.current.session?.email).toBe("alice@test.com")
  })

  it("translates a 409 into the taken-email message", async () => {
    vi.mocked(registerWithPassword).mockRejectedValue(new ApiError(409, "Email already in use"))
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.register("Alice", "taken@test.com", "pass1234"))

    expect(result.current.error).toBe(en.errors.emailTaken)
    expect(result.current.session).toBeNull()
  })

  it("surfaces the pending-approval message and stores nothing in approval mode", async () => {
    vi.mocked(registerWithPassword).mockResolvedValue({ pending: true })
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.register("Alice", "alice@test.com", "pass1234"))

    expect(result.current.error).toBe(en.auth.accountPending)
    expect(upsertPrimaryInstance).not.toHaveBeenCalled()
    expect(result.current.session).toBeNull()
  })
})

describe("loginOAuth", () => {
  it("opens the OAuth window and applies the token pushed by the event", async () => {
    const unlisten = vi.fn()
    let emit: ((event: { payload: string }) => void) | null = null
    vi.mocked(listen).mockImplementation(async (_name, handler) => {
      emit = handler as typeof emit
      return unlisten
    })
    vi.mocked(readInstances).mockResolvedValueOnce([]).mockResolvedValue([instance()])

    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    let pending: Promise<void>
    await act(async () => {
      pending = result.current.loginOAuth("github")
    })
    await waitFor(() => expect(emit).not.toBeNull())
    await act(async () => {
      emit!({ payload: validToken })
      await pending
    })

    expect(invoke).toHaveBeenCalledWith("open_oauth_window", {
      provider: "github",
      apiUrl: "https://api.test",
    })
    expect(unlisten).toHaveBeenCalled()
    expect(upsertPrimaryInstance).toHaveBeenCalledWith({
      url: "https://api.test",
      token: validToken,
    })
    expect(result.current.session?.userId).toBe("u1")
  })

  it("surfaces a generic message when the OAuth window cannot be opened", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("window failed"))
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.loginOAuth("google"))

    expect(result.current.error).toBe(en.errors.serverError)
  })

  it("surfaces a generic message when the OAuth listener cannot be registered", async () => {
    vi.mocked(listen).mockRejectedValue(new Error("listen failed"))
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.loginOAuth("google"))

    expect(result.current.error).toBe(en.errors.serverError)
  })
})

describe("logout", () => {
  it("clears every instance and drops the session", async () => {
    vi.mocked(readInstances).mockResolvedValueOnce([instance()]).mockResolvedValue([])
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.session).not.toBeNull())

    await act(() => result.current.logout())

    expect(clearInstances).toHaveBeenCalled()
    expect(result.current.session).toBeNull()
  })
})

describe("secondary instances", () => {
  it("adds an instance with its resolved name", async () => {
    vi.mocked(fetchAuthConfig).mockResolvedValue({
      name: "Beta",
      registrationMode: "open",
      emailPassword: true,
      oauth: { github: false, google: false },
    })
    vi.mocked(loginWithPassword).mockResolvedValue(validToken)
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    let err: string | null = "x"
    await act(async () => {
      err = await result.current.addInstance("https://b.example.com", {
        kind: "password",
        email: "u@b.io",
        password: "pw",
      })
    })

    expect(err).toBeNull()
    expect(addInstance).toHaveBeenCalledWith({
      url: "https://b.example.com",
      name: "Beta",
      token: validToken,
    })
  })

  it("falls back to the host when the instance exposes no name", async () => {
    vi.mocked(fetchAuthConfig).mockResolvedValue(null)
    vi.mocked(loginWithPassword).mockResolvedValue(validToken)
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() =>
      result.current.addInstance("https://b.example.com", {
        kind: "password",
        email: "u@b.io",
        password: "pw",
      }),
    )
    expect(addInstance).toHaveBeenCalledWith(
      expect.objectContaining({ name: "https://b.example.com" }),
    )
  })

  it("returns a translated error when adding fails", async () => {
    vi.mocked(loginWithPassword).mockRejectedValue(new ApiError(401, "no"))
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    let err: string | null = null
    await act(async () => {
      err = await result.current.addInstance("https://b.example.com", {
        kind: "password",
        email: "u@b.io",
        password: "bad",
      })
    })
    expect(err).toBe(en.errors.invalidCredentials)
    expect(addInstance).not.toHaveBeenCalled()
  })

  it("registers a new account on an instance and adds it", async () => {
    vi.mocked(fetchAuthConfig).mockResolvedValue(null)
    vi.mocked(registerWithPassword).mockResolvedValue({ token: validToken })
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    let res: { pending?: boolean; error?: string } = {}
    await act(async () => {
      res = await result.current.registerInstance("https://b.example.com", {
        name: "Bea",
        email: "bea@b.io",
        password: "pass1234",
      })
    })

    expect(res).toEqual({})
    expect(registerWithPassword).toHaveBeenCalledWith(
      "Bea",
      "bea@b.io",
      "pass1234",
      "https://b.example.com",
    )
    expect(addInstance).toHaveBeenCalledWith(
      expect.objectContaining({ url: "https://b.example.com", token: validToken }),
    )
  })

  it("returns { pending } and stores nothing when the instance needs approval", async () => {
    vi.mocked(registerWithPassword).mockResolvedValue({ pending: true })
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    let res: { pending?: boolean; error?: string } = {}
    await act(async () => {
      res = await result.current.registerInstance("https://b.example.com", {
        name: "Bea",
        email: "bea@b.io",
        password: "pass1234",
      })
    })

    expect(res).toEqual({ pending: true })
    expect(addInstance).not.toHaveBeenCalled()
  })

  it("returns a translated error when registration fails", async () => {
    vi.mocked(registerWithPassword).mockRejectedValue(new ApiError(409, "taken"))
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    let res: { pending?: boolean; error?: string } = {}
    await act(async () => {
      res = await result.current.registerInstance("https://b.example.com", {
        name: "Bea",
        email: "taken@b.io",
        password: "pass1234",
      })
    })

    expect(res).toEqual({ error: en.errors.emailTaken })
    expect(addInstance).not.toHaveBeenCalled()
  })

  it("reconnects an expired instance by replacing its token", async () => {
    vi.mocked(readInstances).mockResolvedValue([instance({ token: expiredToken })])
    vi.mocked(loginWithPassword).mockResolvedValue(validToken)
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() =>
      result.current.reconnectInstance("i1", {
        kind: "password",
        email: "u@b.io",
        password: "pw",
      }),
    )
    expect(updateInstanceToken).toHaveBeenCalledWith("i1", validToken)
  })

  it("returns an error for an unknown reconnect id", async () => {
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    let err: string | null = null
    await act(async () => {
      err = await result.current.reconnectInstance("nope", {
        kind: "password",
        email: "u@b.io",
        password: "pw",
      })
    })
    expect(err).toBe(en.errors.serverError)
    expect(updateInstanceToken).not.toHaveBeenCalled()
  })

  it("returns a translated error when a reconnect fails", async () => {
    vi.mocked(readInstances).mockResolvedValue([instance({ token: expiredToken })])
    vi.mocked(loginWithPassword).mockRejectedValue(new ApiError(401, "no"))
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.instances).toHaveLength(1))

    let err: string | null = null
    await act(async () => {
      err = await result.current.reconnectInstance("i1", {
        kind: "password",
        email: "u@b.io",
        password: "bad",
      })
    })
    expect(err).toBe(en.errors.invalidCredentials)
  })

  it("removes a secondary instance", async () => {
    vi.mocked(readInstances).mockResolvedValue([instance(), instance({ id: "i2" })])
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.instances).toHaveLength(2))

    await act(() => result.current.removeInstance("i2"))
    expect(removeInstance).toHaveBeenCalledWith("i2")
    expect(clearInstances).not.toHaveBeenCalled()
  })

  it("removing the primary clears everything", async () => {
    vi.mocked(readInstances).mockResolvedValue([instance(), instance({ id: "i2" })])
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.instances).toHaveLength(2))

    await act(() => result.current.removeInstance("i1"))
    expect(clearInstances).toHaveBeenCalled()
    expect(removeInstance).not.toHaveBeenCalled()
  })

  it("renames and promotes instances", async () => {
    vi.mocked(readInstances).mockResolvedValue([instance(), instance({ id: "i2" })])
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.instances).toHaveLength(2))

    await act(() => result.current.renameInstance("i2", "Two"))
    expect(renameInstance).toHaveBeenCalledWith("i2", "Two")

    await act(() => result.current.setPrimary("i2"))
    expect(setPrimaryInstance).toHaveBeenCalledWith("i2")
  })
})
