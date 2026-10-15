import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { useAuth } from "@/hooks/useAuth"
import { readToken, writeToken, clearToken } from "@/lib/store"
import { ApiError, loginWithPassword, registerWithPassword } from "@/lib/api"
import { LanguageProvider } from "@/context/LanguageContext"
import { en } from "@/lib/translations"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }))
vi.mock("@/lib/config", () => ({ API_URL: "https://api.test" }))
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
}))
vi.mock("@/lib/store", () => ({
  readToken: vi.fn().mockResolvedValue(null),
  writeToken: vi.fn().mockResolvedValue(undefined),
  clearToken: vi.fn().mockResolvedValue(undefined),
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

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readToken).mockResolvedValue(null)
  vi.mocked(listen).mockResolvedValue(vi.fn())
})

describe("initial session restore", () => {
  it("restores the session from the stored token", async () => {
    vi.mocked(readToken).mockResolvedValue(validToken)
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toMatchObject({ userId: "u1", email: "alice@test.com" })
    expect(result.current.token).toBe(validToken)
  })

  it("ignores an expired stored token", async () => {
    vi.mocked(readToken).mockResolvedValue(expiredToken)
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
  })

  it("stays signed out when there is no stored token", async () => {
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
    expect(result.current.token).toBeNull()
  })
})

describe("login", () => {
  it("stores the token and exposes the decoded session", async () => {
    vi.mocked(loginWithPassword).mockResolvedValue(validToken)
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.login("alice@test.com", "pw"))

    expect(loginWithPassword).toHaveBeenCalledWith("alice@test.com", "pw")
    expect(writeToken).toHaveBeenCalledWith(validToken)
    expect(result.current.session?.userId).toBe("u1")
    expect(result.current.error).toBeNull()
  })

  it("translates a 401 instead of showing the API message", async () => {
    vi.mocked(loginWithPassword).mockRejectedValue(new ApiError(401, "Login failed: 401"))
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.login("alice@test.com", "bad"))

    expect(result.current.error).toBe(en.errors.invalidCredentials)
    expect(writeToken).not.toHaveBeenCalled()
    expect(result.current.session).toBeNull()
  })

  it("falls back to a generic message for any other rejection", async () => {
    vi.mocked(loginWithPassword).mockRejectedValue(new Error("network down"))
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.login("alice@test.com", "pw"))

    expect(result.current.error).toBe(en.errors.serverError)
  })
})

describe("register", () => {
  it("stores the token and exposes the decoded session", async () => {
    vi.mocked(registerWithPassword).mockResolvedValue(validToken)
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.register("Alice", "alice@test.com", "pw"))

    expect(registerWithPassword).toHaveBeenCalledWith("Alice", "alice@test.com", "pw")
    expect(writeToken).toHaveBeenCalledWith(validToken)
    expect(result.current.session?.email).toBe("alice@test.com")
  })

  it("translates a 409 into the taken-email message", async () => {
    vi.mocked(registerWithPassword).mockRejectedValue(new ApiError(409, "Register failed: 409"))
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.register("Alice", "alice@test.com", "pw"))

    expect(result.current.error).toBe(en.errors.emailTaken)
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
    expect(writeToken).toHaveBeenCalledWith(validToken)
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
  it("clears the stored token and drops the session", async () => {
    vi.mocked(readToken).mockResolvedValue(validToken)
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.session).not.toBeNull())

    await act(() => result.current.logout())

    expect(clearToken).toHaveBeenCalled()
    expect(result.current.session).toBeNull()
  })
})
