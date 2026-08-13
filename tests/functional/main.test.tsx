import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn().mockReturnValue({
    session: null,
    loading: true,
    error: null,
    login: vi.fn(),
    loginOAuth: vi.fn(),
    logout: vi.fn(),
  }),
}))
vi.mock("@/hooks/useUpdater", () => ({
  useUpdater: vi.fn().mockReturnValue({
    status: "idle",
    downloadProgress: null,
    checkForUpdates: vi.fn(),
    dismiss: vi.fn(),
  }),
}))
vi.mock("@/lib/store", () => ({
  readLang: vi.fn().mockResolvedValue(null),
  writeLang: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/styles/globals.css", () => ({}))

beforeEach(() => {
  vi.resetModules()
  document.body.innerHTML = '<div id="root"></div>'
})

describe("main entry point", () => {
  it("mounts the app into #root", async () => {
    await import("@/main")

    await vi.waitFor(() => expect(document.getElementById("root")?.innerHTML).not.toBe(""))
  })
})
