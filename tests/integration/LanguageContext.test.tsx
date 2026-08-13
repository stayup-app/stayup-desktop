import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { LanguageProvider, useLanguage } from "@/context/LanguageContext"
import { readLang, writeLang } from "@/lib/store"

vi.mock("@/lib/store", () => ({
  readLang: vi.fn().mockResolvedValue(null),
  writeLang: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readLang).mockResolvedValue(null)
})

describe("LanguageProvider", () => {
  it("defaults to French", async () => {
    const { result } = renderHook(() => useLanguage(), { wrapper: LanguageProvider })

    await waitFor(() => expect(readLang).toHaveBeenCalled())
    expect(result.current.lang).toBe("fr")
    expect(result.current.t.feed.allFeeds).toBe("Tous les flux")
  })

  it("restores a stored language preference", async () => {
    vi.mocked(readLang).mockResolvedValue("en")
    const { result } = renderHook(() => useLanguage(), { wrapper: LanguageProvider })

    await waitFor(() => expect(result.current.lang).toBe("en"))
    expect(result.current.t.feed.allFeeds).toBe("All feeds")
  })

  it("keeps the default when nothing is stored", async () => {
    const { result } = renderHook(() => useLanguage(), { wrapper: LanguageProvider })

    await waitFor(() => expect(readLang).toHaveBeenCalled())
    expect(result.current.lang).toBe("fr")
  })

  it("switches the dictionary and persists the choice", async () => {
    const { result } = renderHook(() => useLanguage(), { wrapper: LanguageProvider })
    await waitFor(() => expect(readLang).toHaveBeenCalled())

    act(() => result.current.setLang("en"))

    expect(result.current.lang).toBe("en")
    expect(result.current.t.auth.signIn).toBe("Sign in")
    expect(writeLang).toHaveBeenCalledWith("en")
  })

  it("throws when used outside of LanguageProvider", () => {
    expect(() => renderHook(() => useLanguage())).toThrow(
      "useLanguage must be used within LanguageProvider",
    )
  })
})
