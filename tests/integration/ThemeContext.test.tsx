import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { ThemeProvider, useTheme } from "@/context/ThemeContext"

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove("dark")
})

describe("ThemeProvider", () => {
  it("defaults to light when no stored preference and system is light", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    expect(result.current.theme).toBe("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("restores a stored 'dark' preference from localStorage", () => {
    localStorage.setItem("theme", "dark")
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    expect(result.current.theme).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("restores a stored 'light' preference from localStorage", () => {
    localStorage.setItem("theme", "light")
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    expect(result.current.theme).toBe("light")
  })

  it("toggles from light to dark", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("toggles from dark back to light", () => {
    localStorage.setItem("theme", "dark")
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("persists the chosen theme in localStorage", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    act(() => result.current.toggleTheme())
    expect(localStorage.getItem("theme")).toBe("dark")
    act(() => result.current.toggleTheme())
    expect(localStorage.getItem("theme")).toBe("light")
  })

  it("throws when used outside of ThemeProvider", () => {
    expect(() => renderHook(() => useTheme())).toThrow("useTheme must be used within ThemeProvider")
  })
})

describe("system preference", () => {
  function mockMatchMedia(matches: boolean) {
    const listeners: ((e: MediaQueryListEvent) => void)[] = []
    const addEventListener = vi.fn((_: string, h: (e: MediaQueryListEvent) => void) =>
      listeners.push(h),
    )
    const removeEventListener = vi.fn()
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches, addEventListener, removeEventListener }),
    )
    return { listeners, removeEventListener }
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("falls back to the dark system preference when nothing is stored", () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    expect(result.current.theme).toBe("dark")
  })

  it("falls back to the light system preference when nothing is stored", () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider })
    expect(result.current.theme).toBe("light")
  })

  it("does not subscribe to system changes once a preference is stored", () => {
    localStorage.setItem("theme", "light")
    const { listeners } = mockMatchMedia(false)
    renderHook(() => useTheme(), { wrapper: ThemeProvider })
    expect(listeners).toHaveLength(0)
  })

  // The mount effect persists the resolved theme before the subscription effect
  // runs, so the "no stored preference" branch is never taken in practice.
  it("does not subscribe to system changes on a fresh start either", () => {
    const { listeners } = mockMatchMedia(false)
    renderHook(() => useTheme(), { wrapper: ThemeProvider })
    expect(listeners).toHaveLength(0)
  })
})
