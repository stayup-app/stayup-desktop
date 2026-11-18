import { useCallback, useEffect, useRef, useState } from "react"
import { Check } from "lucide-react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { getVersion } from "@tauri-apps/api/app"
import { message } from "@tauri-apps/plugin-dialog"
import { exit } from "@tauri-apps/plugin-process"
import type { Language, Translations } from "@/lib/translations"
import { usesCustomMenuBar } from "@/lib/platform"

interface MenuBarProps {
  lang: Language
  t: Translations
  setLang: (l: Language) => void
  onCheckUpdates: () => void
  onRefresh: () => void
}

type Entry =
  | { type: "separator" }
  | {
      type: "item"
      label: string
      shortcut?: string
      checked?: boolean
      action: () => void | Promise<void>
    }

interface Menu {
  id: string
  title: string
  entries: Entry[]
}

async function toggleFullscreen() {
  const win = getCurrentWindow()
  await win.setFullscreen(!(await win.isFullscreen()))
}

export function MenuBar(props: MenuBarProps) {
  // Other platforms keep their native menu (see useMenu).
  if (!usesCustomMenuBar()) return null
  return <LinuxMenuBar {...props} />
}

function LinuxMenuBar({ lang, t, setLang, onCheckUpdates, onRefresh }: MenuBarProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const showAbout = useCallback(async () => {
    const version = await getVersion()
    await message(
      `${t.menu.help.aboutComment}\n\nv${version}\nhttps://github.com/stayup-app/stayup-desktop`,
      {
        title: t.menu.help.about,
      },
    )
  }, [t])

  const languages: ReadonlyArray<readonly [Language, string]> = [
    ["en", t.menu.language.english],
    ["fr", t.menu.language.french],
    ["de", t.menu.language.german],
    ["es", t.menu.language.spanish],
    ["it", t.menu.language.italian],
    ["pt", t.menu.language.portuguese],
    ["ja", t.menu.language.japanese],
    ["zh", t.menu.language.chinese],
  ]

  const menus: Menu[] = [
    {
      id: "file",
      title: t.menu.file.title,
      entries: [
        { type: "item", label: t.menu.file.checkForUpdates, action: onCheckUpdates },
        { type: "item", label: t.menu.file.refresh, shortcut: "Ctrl+R", action: onRefresh },
        { type: "separator" },
        { type: "item", label: t.menu.file.quit, shortcut: "Ctrl+Q", action: () => exit(0) },
      ],
    },
    {
      id: "language",
      title: t.menu.language.title,
      entries: languages.map(([code, label]) => ({
        type: "item" as const,
        label,
        checked: lang === code,
        action: () => setLang(code),
      })),
    },
    {
      id: "display",
      title: t.menu.display.title,
      entries: [
        {
          type: "item",
          label: t.menu.display.fullscreen,
          shortcut: "F11",
          action: toggleFullscreen,
        },
      ],
    },
    {
      id: "help",
      title: t.menu.help.title,
      entries: [{ type: "item", label: t.menu.help.about, action: showAbout }],
    },
  ]

  // The native menu carried these accelerators; keep them working.
  const shortcutsRef = useRef({ onRefresh })
  useEffect(() => {
    shortcutsRef.current = { onRefresh }
  }, [onRefresh])
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F11") {
        e.preventDefault()
        void toggleFullscreen()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        e.preventDefault()
        shortcutsRef.current.onRefresh()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "q") {
        e.preventDefault()
        void exit(0)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (openId === null) return
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenId(null)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenId(null)
        return
      }
      const index = menus.findIndex((m) => m.id === openId)
      if (e.key === "ArrowRight") setOpenId(menus[(index + 1) % menus.length].id)
      else if (e.key === "ArrowLeft") setOpenId(menus[(index - 1 + menus.length) % menus.length].id)
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        const items = Array.from(
          rootRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [],
        )
        if (items.length === 0) return
        const at = items.indexOf(document.activeElement as HTMLElement)
        const step = e.key === "ArrowDown" ? 1 : -1
        items[(at + step + items.length) % items.length].focus()
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  })

  return (
    <div
      ref={rootRef}
      role="menubar"
      className="relative z-50 flex h-7 shrink-0 items-center px-1 text-[13px]"
      style={{ background: "var(--bg-soft)", borderBottom: "1px solid var(--border-soft)" }}
    >
      {menus.map((menu) => {
        const open = openId === menu.id
        return (
          <div key={menu.id} className="relative">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : menu.id)}
              onMouseEnter={() => openId !== null && setOpenId(menu.id)}
              className="h-7 px-3 outline-none"
              style={{
                background: open ? "hsl(var(--primary))" : "transparent",
                color: open ? "hsl(var(--primary-foreground))" : "var(--fg-soft)",
              }}
            >
              {menu.title}
            </button>
            {open && (
              <div
                role="menu"
                aria-label={menu.title}
                className="absolute left-0 top-full min-w-[220px] py-1"
                style={{
                  background: "var(--surface-hi)",
                  color: "var(--fg)",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
                }}
              >
                {menu.entries.map((entry, i) =>
                  entry.type === "separator" ? (
                    <div
                      key={`sep-${i}`}
                      role="separator"
                      className="my-1 h-px"
                      style={{ background: "var(--border-color)" }}
                    />
                  ) : (
                    <button
                      key={entry.label}
                      type="button"
                      role={entry.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                      aria-checked={entry.checked}
                      onClick={() => {
                        setOpenId(null)
                        void entry.action()
                      }}
                      className="flex w-full items-center gap-6 px-4 py-[7px] text-left outline-none hover:bg-[var(--border-color)] focus:bg-[var(--border-color)]"
                    >
                      <span className="w-4 shrink-0">
                        {entry.checked && <Check size={14} aria-hidden="true" />}
                      </span>
                      <span className="flex-1 whitespace-nowrap">{entry.label}</span>
                      {entry.shortcut && (
                        <span className="text-[12px]" style={{ color: "var(--muted-fg)" }}>
                          {entry.shortcut}
                        </span>
                      )}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
