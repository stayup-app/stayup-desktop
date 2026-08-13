import "@testing-library/jest-dom"
import { vi } from "vitest"

// jsdom v29 does not expose localStorage.clear — provide a full implementation
const localStorageMap = new Map<string, string>()
const localStorageMock = {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
  get length() {
    return localStorageMap.size
  },
  key: (index: number) => [...localStorageMap.keys()][index] ?? null,
}
Object.defineProperty(window, "localStorage", { value: localStorageMock, writable: true })

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

vi.mock("@tauri-apps/plugin-store", () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock("@tauri-apps/plugin-shell", () => ({
  open: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@tauri-apps/api", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

// jsdom does not implement scrollIntoView, which FeedLayout uses to keep the
// selected row visible.
Element.prototype.scrollIntoView = vi.fn()
