import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { useAuth } from "@/hooks/useAuth"
import { readToken, writeToken, clearToken, readApiUrl } from "@/lib/store"
import { ApiError, loginWithPassword, registerWithPassword } from "@/lib/api"
import { LanguageProvider } from "@/context/LanguageContext"
import { en } from "@/lib/translations"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }))
// useAuth traduit les erreurs à partir du statut porté par ApiError : le mock doit
// donc l'exposer, sinon `err instanceof ApiError` ne peut jamais être vrai.
// La classe est définie dans la factory : vi.mock est hoisté au-dessus du module.
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
  readToken: vi.fn(),
  writeToken: vi.fn().mockResolvedValue(undefined),
  clearToken: vi.fn().mockResolvedValue(undefined),
  readApiUrl: vi.fn().mockResolvedValue("https://api.test"),
  // LanguageProvider, qui enveloppe désormais le hook, lit et écrit la langue.
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
  vi.mocked(readApiUrl).mockResolvedValue("https://api.test")
  vi.mocked(listen).mockResolvedValue(vi.fn())
})

describe("initial session restore", () => {
  it("restores a session from a valid stored token", async () => {
    vi.mocked(readToken).mockResolvedValue(validToken)
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toEqual({
      userId: "u1",
      name: "Alice",
      email: "alice@test.com",
      role: "user",
    })
  })

  it("clears an expired stored token and stays signed out", async () => {
    vi.mocked(readToken).mockResolvedValue(expiredToken)
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
    expect(clearToken).toHaveBeenCalled()
  })

  it("stays signed out when no token is stored", async () => {
    const { result } = renderAuth()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
    expect(clearToken).not.toHaveBeenCalled()
  })
})

describe("login", () => {
  it("persists the token and exposes the decoded session", async () => {
    vi.mocked(loginWithPassword).mockResolvedValue(validToken)
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.login("alice@test.com", "pass"))

    expect(loginWithPassword).toHaveBeenCalledWith("alice@test.com", "pass", "https://api.test")
    expect(writeToken).toHaveBeenCalledWith(validToken)
    expect(result.current.session?.email).toBe("alice@test.com")
  })

  // Le message de l'API est en anglais quelle que soit la langue : on le traduit à
  // partir du statut plutôt que de l'afficher tel quel.
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
  it("persists the token and exposes the decoded session", async () => {
    vi.mocked(registerWithPassword).mockResolvedValue(validToken)
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.register("Alice", "alice@test.com", "pass1234"))

    expect(registerWithPassword).toHaveBeenCalledWith(
      "Alice",
      "alice@test.com",
      "pass1234",
      "https://api.test",
    )
    expect(writeToken).toHaveBeenCalledWith(validToken)
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

  it("falls back to a generic message for any other rejection", async () => {
    vi.mocked(registerWithPassword).mockRejectedValue("nope")
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.register("Alice", "a@b.c", "pass1234"))

    expect(result.current.error).toBe(en.errors.serverError)
  })
})

describe("loginOAuth", () => {
  it("opens the OAuth window and applies the token pushed by the event", async () => {
    const unlisten = vi.fn()
    let emit: ((event: { payload: string }) => Promise<void>) | null = null
    vi.mocked(listen).mockImplementation(async (_name, handler) => {
      emit = handler as typeof emit
      return unlisten
    })

    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.loginOAuth("github"))
    expect(invoke).toHaveBeenCalledWith("open_oauth_window", {
      provider: "github",
      apiUrl: "https://api.test",
    })

    await act(async () => {
      await emit!({ payload: validToken })
    })

    expect(unlisten).toHaveBeenCalled()
    expect(writeToken).toHaveBeenCalledWith(validToken)
    expect(result.current.session?.userId).toBe("u1")
  })

  it("surfaces an error when the OAuth window cannot be opened", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("window failed"))
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.loginOAuth("google"))

    expect(result.current.error).toBe("window failed")
  })

  it("falls back to a generic message for a non-Error rejection", async () => {
    vi.mocked(invoke).mockRejectedValue("boom")
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.loginOAuth("google"))

    expect(result.current.error).toBe("Erreur OAuth.")
  })
})

describe("logout", () => {
  it("clears the token and the session", async () => {
    vi.mocked(readToken).mockResolvedValue(validToken)
    const { result } = renderAuth()
    await waitFor(() => expect(result.current.session).not.toBeNull())

    await act(() => result.current.logout())

    expect(clearToken).toHaveBeenCalled()
    expect(result.current.session).toBeNull()
  })
})
