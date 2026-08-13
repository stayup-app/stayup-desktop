import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { check } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"
import { useUpdater } from "@/hooks/useUpdater"

vi.mock("@tauri-apps/plugin-updater", () => ({ check: vi.fn() }))
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn().mockResolvedValue(undefined) }))

type ProgressEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" }

function updateWith(events: ProgressEvent[]) {
  return {
    downloadAndInstall: vi.fn(async (onEvent: (e: ProgressEvent) => void) => {
      for (const e of events) onEvent(e)
    }),
  } as unknown as NonNullable<Awaited<ReturnType<typeof check>>>
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useUpdater", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useUpdater())
    expect(result.current.status).toBe("idle")
    expect(result.current.downloadProgress).toBeNull()
  })

  it("reports up-to-date when no update is available", async () => {
    vi.mocked(check).mockResolvedValue(null)
    const { result } = renderHook(() => useUpdater())

    await act(() => result.current.checkForUpdates())

    expect(result.current.status).toBe("up-to-date")
  })

  it("downloads, tracks progress and relaunches", async () => {
    vi.mocked(check).mockResolvedValue(
      updateWith([
        { event: "Started", data: { contentLength: 200 } },
        { event: "Progress", data: { chunkLength: 50 } },
        { event: "Progress", data: { chunkLength: 50 } },
        { event: "Finished" },
      ]),
    )
    const { result } = renderHook(() => useUpdater())

    await act(() => result.current.checkForUpdates())

    expect(result.current.downloadProgress).toBe(100)
    expect(relaunch).toHaveBeenCalled()
    expect(result.current.status).toBe("restarting")
  })

  it("leaves progress untouched when the total size is unknown", async () => {
    vi.mocked(check).mockResolvedValue(
      updateWith([
        { event: "Started", data: {} },
        { event: "Progress", data: { chunkLength: 50 } },
      ]),
    )
    const { result } = renderHook(() => useUpdater())

    await act(() => result.current.checkForUpdates())

    expect(result.current.downloadProgress).toBe(0)
  })

  it("switches to error when the check throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(check).mockRejectedValue(new Error("offline"))
    const { result } = renderHook(() => useUpdater())

    await act(() => result.current.checkForUpdates())

    expect(result.current.status).toBe("error")
  })

  it("resets to idle on dismiss", async () => {
    vi.mocked(check).mockResolvedValue(null)
    const { result } = renderHook(() => useUpdater())
    await act(() => result.current.checkForUpdates())

    act(() => result.current.dismiss())

    expect(result.current.status).toBe("idle")
    expect(result.current.downloadProgress).toBeNull()
  })
})

describe("progress events", () => {
  it("ignores progress events that arrive before the download starts", async () => {
    vi.mocked(check).mockResolvedValue(
      updateWith([{ event: "Progress", data: { chunkLength: 10 } }]),
    )
    const { result } = renderHook(() => useUpdater())

    await act(() => result.current.checkForUpdates())

    expect(result.current.downloadProgress).toBeNull()
  })
})
