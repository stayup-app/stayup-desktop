import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { message } from "@tauri-apps/plugin-dialog"
import { exit } from "@tauri-apps/plugin-process"
import { MenuBar } from "@/components/layout/MenuBar"
import { fr } from "@/lib/translations/fr"

vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }))
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn().mockResolvedValue("9.9.9") }))
vi.mock("@tauri-apps/plugin-dialog", () => ({ message: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@tauri-apps/plugin-process", () => ({ exit: vi.fn().mockResolvedValue(undefined) }))

const LINUX_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko)"

function setUserAgent(ua: string) {
  vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(ua)
}

function props() {
  return {
    lang: "fr" as const,
    t: fr,
    setLang: vi.fn(),
    onCheckUpdates: vi.fn(),
    onRefresh: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("MenuBar", () => {
  it("renders nothing off Linux (macOS/Windows keep their native menu)", () => {
    setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15")
    render(<MenuBar {...props()} />)
    expect(screen.queryByRole("menubar")).toBeNull()
  })

  it("renders nothing on Android", () => {
    setUserAgent("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36")
    render(<MenuBar {...props()} />)
    expect(screen.queryByRole("menubar")).toBeNull()
  })

  it("shows the four menus on Linux", () => {
    setUserAgent(LINUX_UA)
    render(<MenuBar {...props()} />)
    const titles = screen.getAllByRole("menuitem").map((b) => b.textContent)
    expect(titles).toEqual([
      fr.menu.file.title,
      fr.menu.language.title,
      fr.menu.display.title,
      fr.menu.help.title,
    ])
  })

  it("opens a flat dropdown (no border, no rounded corners) and closes on Escape", async () => {
    setUserAgent(LINUX_UA)
    render(<MenuBar {...props()} />)
    await userEvent.click(screen.getByRole("menuitem", { name: fr.menu.language.title }))

    const dropdown = screen.getByRole("menu", { name: fr.menu.language.title })
    expect(dropdown.style.border).toBe("")
    expect(dropdown.style.borderRadius).toBe("")
    expect(dropdown.className).not.toMatch(/rounded|border/)

    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("menu")).toBeNull()
  })

  it("closes when clicking outside", async () => {
    setUserAgent(LINUX_UA)
    render(<MenuBar {...props()} />)
    await userEvent.click(screen.getByRole("menuitem", { name: fr.menu.file.title }))
    expect(screen.getByRole("menu")).toBeTruthy()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole("menu")).toBeNull()
  })

  it("switches menu on hover while one is open", async () => {
    setUserAgent(LINUX_UA)
    render(<MenuBar {...props()} />)
    await userEvent.click(screen.getByRole("menuitem", { name: fr.menu.file.title }))
    await userEvent.hover(screen.getByRole("menuitem", { name: fr.menu.display.title }))

    expect(screen.getByRole("menu", { name: fr.menu.display.title })).toBeTruthy()
    expect(screen.queryByRole("menu", { name: fr.menu.file.title })).toBeNull()
  })

  it("moves between menus with the left/right arrow keys", async () => {
    setUserAgent(LINUX_UA)
    render(<MenuBar {...props()} />)
    await userEvent.click(screen.getByRole("menuitem", { name: fr.menu.file.title }))

    fireEvent.keyDown(document, { key: "ArrowRight" })
    expect(screen.getByRole("menu", { name: fr.menu.language.title })).toBeTruthy()
    fireEvent.keyDown(document, { key: "ArrowLeft" })
    fireEvent.keyDown(document, { key: "ArrowLeft" })
    expect(screen.getByRole("menu", { name: fr.menu.help.title })).toBeTruthy()
  })

  it("marks the current language and switches language on click", async () => {
    setUserAgent(LINUX_UA)
    const p = props()
    render(<MenuBar {...p} />)
    await userEvent.click(screen.getByRole("menuitem", { name: fr.menu.language.title }))

    const checked = screen
      .getAllByRole("menuitemcheckbox")
      .filter((el) => el.getAttribute("aria-checked") === "true")
    expect(checked).toHaveLength(1)
    expect(checked[0].textContent).toContain(fr.menu.language.french)

    await userEvent.click(
      screen.getByRole("menuitemcheckbox", { name: new RegExp(fr.menu.language.german) }),
    )
    expect(p.setLang).toHaveBeenCalledWith("de")
    expect(screen.queryByRole("menu")).toBeNull()
  })

  it("wires the File menu actions", async () => {
    setUserAgent(LINUX_UA)
    const p = props()
    render(<MenuBar {...p} />)

    await userEvent.click(screen.getByRole("menuitem", { name: fr.menu.file.title }))
    await userEvent.click(screen.getByRole("menuitem", { name: fr.menu.file.checkForUpdates }))
    expect(p.onCheckUpdates).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole("menuitem", { name: fr.menu.file.title }))
    await userEvent.click(screen.getByRole("menuitem", { name: new RegExp(fr.menu.file.refresh) }))
    expect(p.onRefresh).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole("menuitem", { name: fr.menu.file.title }))
    await userEvent.click(screen.getByRole("menuitem", { name: new RegExp(fr.menu.file.quit) }))
    expect(exit).toHaveBeenCalledWith(0)
  })

  it("toggles fullscreen from the Display menu", async () => {
    setUserAgent(LINUX_UA)
    const win = {
      isFullscreen: vi.fn().mockResolvedValue(false),
      setFullscreen: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(getCurrentWindow).mockReturnValue(win as never)
    render(<MenuBar {...props()} />)

    await userEvent.click(screen.getByRole("menuitem", { name: fr.menu.display.title }))
    await userEvent.click(
      screen.getByRole("menuitem", { name: new RegExp(fr.menu.display.fullscreen) }),
    )
    await waitFor(() => expect(win.setFullscreen).toHaveBeenCalledWith(true))
  })

  it("shows the About dialog with the app version", async () => {
    setUserAgent(LINUX_UA)
    render(<MenuBar {...props()} />)
    await userEvent.click(screen.getByRole("menuitem", { name: fr.menu.help.title }))
    await userEvent.click(screen.getByRole("menuitem", { name: fr.menu.help.about }))

    await waitFor(() => expect(message).toHaveBeenCalled())
    const [body, opts] = vi.mocked(message).mock.calls[0]
    expect(body).toContain(fr.menu.help.aboutComment)
    expect(body).toContain("9.9.9")
    expect(opts).toEqual({ title: fr.menu.help.about })
  })

  it("keeps the native accelerators: Ctrl+R refreshes, Ctrl+Q quits, F11 toggles fullscreen", async () => {
    setUserAgent(LINUX_UA)
    const win = {
      isFullscreen: vi.fn().mockResolvedValue(true),
      setFullscreen: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(getCurrentWindow).mockReturnValue(win as never)
    const p = props()
    render(<MenuBar {...p} />)

    fireEvent.keyDown(window, { key: "r", ctrlKey: true })
    expect(p.onRefresh).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: "q", ctrlKey: true })
    expect(exit).toHaveBeenCalledWith(0)

    fireEvent.keyDown(window, { key: "F11" })
    await waitFor(() => expect(win.setFullscreen).toHaveBeenCalledWith(false))
  })
})
