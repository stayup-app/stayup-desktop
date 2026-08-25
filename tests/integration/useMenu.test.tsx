import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { Menu, MenuItem, Submenu, CheckMenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { exit } from "@tauri-apps/plugin-process"
import { useMenu } from "@/hooks/useMenu"
import { fr } from "@/lib/translations/fr"

const setAsAppMenu = vi.fn().mockResolvedValue(undefined)

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: { new: vi.fn() },
  MenuItem: { new: vi.fn() },
  Submenu: { new: vi.fn() },
  CheckMenuItem: { new: vi.fn() },
  PredefinedMenuItem: { new: vi.fn() },
}))
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }))
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn().mockResolvedValue("9.9.9") }))
vi.mock("@tauri-apps/plugin-process", () => ({ exit: vi.fn().mockResolvedValue(undefined) }))

interface ItemOptions {
  text?: string
  action?: () => void | Promise<void>
  checked?: boolean
  accelerator?: string
  item?: unknown
  items?: unknown[]
}

/** Every option object passed to a MenuItem/CheckMenuItem constructor, in creation order. */
let created: ItemOptions[] = []

function optionsFor(text: string): ItemOptions {
  const found = created.find((o) => o.text === text)
  if (!found) throw new Error(`No menu item created with text "${text}"`)
  return found
}

function baseProps() {
  return {
    lang: "fr" as const,
    t: fr,
    theme: "light" as const,
    setLang: vi.fn(),
    setTheme: vi.fn(),
    onCheckUpdates: vi.fn(),
    onRefresh: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  created = []
  const record = vi.fn(async (opts: ItemOptions = {}) => {
    created.push(opts)
    return opts
  })
  vi.mocked(MenuItem.new).mockImplementation(record as never)
  vi.mocked(CheckMenuItem.new).mockImplementation(record as never)
  vi.mocked(PredefinedMenuItem.new).mockImplementation(record as never)
  vi.mocked(Submenu.new).mockImplementation(record as never)
  vi.mocked(Menu.new).mockResolvedValue({ setAsAppMenu } as never)
})

describe("useMenu", () => {
  it("builds the four submenus and installs them as the app menu", async () => {
    renderHook(() => useMenu(baseProps()))

    await waitFor(() => expect(setAsAppMenu).toHaveBeenCalled())
    const submenuTitles = vi.mocked(Submenu.new).mock.calls.map(([o]) => (o as ItemOptions).text)
    expect(submenuTitles).toEqual([
      fr.menu.file.title,
      fr.menu.language.title,
      fr.menu.display.title,
      fr.menu.help.title,
    ])
  })

  it("wires the File menu actions to the latest callbacks", async () => {
    const props = baseProps()
    renderHook(() => useMenu(props))
    await waitFor(() => expect(setAsAppMenu).toHaveBeenCalled())

    optionsFor(fr.menu.file.checkForUpdates).action!()
    optionsFor(fr.menu.file.refresh).action!()
    optionsFor(fr.menu.file.quit).action!()

    expect(props.onCheckUpdates).toHaveBeenCalled()
    expect(props.onRefresh).toHaveBeenCalled()
    expect(exit).toHaveBeenCalledWith(0)
  })

  it("keeps the action bound to a re-rendered callback without rebuilding the menu", async () => {
    const first = baseProps()
    const { rerender } = renderHook((p: ReturnType<typeof baseProps>) => useMenu(p), {
      initialProps: first,
    })
    await waitFor(() => expect(setAsAppMenu).toHaveBeenCalledTimes(1))

    const onRefresh = vi.fn()
    rerender({ ...first, onRefresh })
    optionsFor(fr.menu.file.refresh).action!()

    expect(onRefresh).toHaveBeenCalled()
    expect(first.onRefresh).not.toHaveBeenCalled()
    expect(setAsAppMenu).toHaveBeenCalledTimes(1)
  })

  it("checks the active language and switches on click", async () => {
    const props = baseProps()
    renderHook(() => useMenu(props))
    await waitFor(() => expect(setAsAppMenu).toHaveBeenCalled())

    expect(optionsFor(fr.menu.language.french).checked).toBe(true)
    expect(optionsFor(fr.menu.language.english).checked).toBe(false)

    optionsFor(fr.menu.language.english).action!()
    expect(props.setLang).toHaveBeenCalledWith("en")

    optionsFor(fr.menu.language.french).action!()
    expect(props.setLang).toHaveBeenCalledWith("fr")
  })

  it("does not offer a light/dark switch — Aurora is dark-only", async () => {
    renderHook(() => useMenu(baseProps()))
    await waitFor(() => expect(setAsAppMenu).toHaveBeenCalled())

    expect(created.some((o) => o.text === fr.menu.display.lightMode)).toBe(false)
    expect(created.some((o) => o.text === fr.menu.display.darkMode)).toBe(false)
  })

  it("toggles fullscreen on the current window", async () => {
    const setFullscreen = vi.fn().mockResolvedValue(undefined)
    vi.mocked(getCurrentWindow).mockReturnValue({
      isFullscreen: vi.fn().mockResolvedValue(false),
      setFullscreen,
    } as never)

    renderHook(() => useMenu(baseProps()))
    await waitFor(() => expect(setAsAppMenu).toHaveBeenCalled())

    await optionsFor(fr.menu.display.fullscreen).action!()
    expect(setFullscreen).toHaveBeenCalledWith(true)
  })

  it("includes the app version in the About item", async () => {
    renderHook(() => useMenu(baseProps()))
    await waitFor(() => expect(setAsAppMenu).toHaveBeenCalled())

    const about = optionsFor(fr.menu.help.about).item as {
      About: { version: string; comments: string; authors?: string[] }
    }
    expect(about.About.version).toBe("9.9.9")
    expect(about.About.comments).toBe(fr.menu.help.aboutComment)
    // No `authors` — keeps the native About dialog to a single pane, no Credits tab.
    expect(about.About.authors).toBeUndefined()
  })

  it("does not install the menu when the effect is torn down mid-build", async () => {
    const { unmount } = renderHook(() => useMenu(baseProps()))
    unmount()

    await new Promise((r) => setTimeout(r, 0))
    expect(setAsAppMenu).not.toHaveBeenCalled()
  })
})
