import { describe, it, expect, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useNavigationStore } from "@/store/navigation"

beforeEach(() => {
  useNavigationStore.setState({ selection: { type: "all" } })
})

describe("useNavigationStore", () => {
  it("starts with the 'all' selection", () => {
    const { result } = renderHook(() => useNavigationStore())
    expect(result.current.selection.type).toBe("all")
  })

  it("switches to a category selection", () => {
    const { result } = renderHook(() => useNavigationStore())
    act(() => result.current.setSelection({ type: "category", provider: "youtube" }))
    expect(result.current.selection).toEqual({ type: "category", provider: "youtube" })
  })

  it("switches to a specific flux selection", () => {
    const { result } = renderHook(() => useNavigationStore())
    act(() =>
      result.current.setSelection({
        type: "flux",
        fluxId: "flux-123",
        provider: "changelog",
        instanceId: "i1",
      }),
    )
    expect(result.current.selection).toEqual({
      type: "flux",
      fluxId: "flux-123",
      provider: "changelog",
      instanceId: "i1",
    })
  })

  it("can navigate back to 'all' from a flux selection", () => {
    const { result } = renderHook(() => useNavigationStore())
    act(() =>
      result.current.setSelection({
        type: "flux",
        fluxId: "f1",
        provider: "rss",
        instanceId: "i1",
      }),
    )
    act(() => result.current.setSelection({ type: "all" }))
    expect(result.current.selection.type).toBe("all")
  })

  it("can switch directly between two categories", () => {
    const { result } = renderHook(() => useNavigationStore())
    act(() => result.current.setSelection({ type: "category", provider: "changelog" }))
    act(() => result.current.setSelection({ type: "category", provider: "rss" }))
    expect(result.current.selection).toEqual({ type: "category", provider: "rss" })
  })
})
