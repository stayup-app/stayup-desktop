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
  it("defaults to English", async () => {
    const { result } = renderHook(() => useLanguage(), { wrapper: LanguageProvider })

    await waitFor(() => expect(readLang).toHaveBeenCalled())
    expect(result.current.lang).toBe("en")
    expect(result.current.t.feed.allFeeds).toBe("All feeds")
  })

  it("restores a stored language preference", async () => {
    vi.mocked(readLang).mockResolvedValue("de")
    const { result } = renderHook(() => useLanguage(), { wrapper: LanguageProvider })

    await waitFor(() => expect(result.current.lang).toBe("de"))
    expect(result.current.t.feed.allFeeds).toBe("Alle Feeds")
  })

  it("keeps the default when nothing is stored", async () => {
    const { result } = renderHook(() => useLanguage(), { wrapper: LanguageProvider })

    await waitFor(() => expect(readLang).toHaveBeenCalled())
    expect(result.current.lang).toBe("en")
  })

  it("switches the dictionary and persists the choice", async () => {
    const { result } = renderHook(() => useLanguage(), { wrapper: LanguageProvider })
    await waitFor(() => expect(readLang).toHaveBeenCalled())

    act(() => result.current.setLang("fr"))

    expect(result.current.lang).toBe("fr")
    expect(result.current.t.auth.signIn).toBe("Se connecter")
    expect(writeLang).toHaveBeenCalledWith("fr")
  })

  it("accepts an explicit initial language", () => {
    const { result } = renderHook(() => useLanguage(), {
      wrapper: ({ children }) => <LanguageProvider initialLang="ja">{children}</LanguageProvider>,
    })
    expect(result.current.lang).toBe("ja")
  })

  it("throws when used outside of LanguageProvider", () => {
    expect(() => renderHook(() => useLanguage())).toThrow(
      "useLanguage must be used within LanguageProvider",
    )
  })
})
