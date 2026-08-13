import { useEffect, useRef } from "react"
import { Menu, MenuItem, Submenu, CheckMenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { getVersion } from "@tauri-apps/api/app"
import { exit } from "@tauri-apps/plugin-process"
import type { Language, Translations } from "@/lib/translations"
import type { Theme } from "@/context/ThemeContext"

interface UseMenuOptions {
  lang: Language
  t: Translations
  theme: Theme
  setLang: (l: Language) => void
  setTheme: (t: Theme) => void
  onCheckUpdates: () => void
  onRefresh: () => void
}

export function useMenu({
  lang,
  t,
  theme,
  setLang,
  setTheme,
  onCheckUpdates,
  onRefresh,
}: UseMenuOptions) {
  const callbacksRef = useRef({ onCheckUpdates, onRefresh })
  useEffect(() => {
    callbacksRef.current = { onCheckUpdates, onRefresh }
  }, [onCheckUpdates, onRefresh])

  useEffect(() => {
    let cancelled = false

    async function buildMenu() {
      const fileMenu = await Submenu.new({
        text: t.menu.file.title,
        items: [
          await MenuItem.new({
            text: t.menu.file.checkForUpdates,
            action: () => callbacksRef.current.onCheckUpdates(),
          }),
          await MenuItem.new({
            text: t.menu.file.refresh,
            accelerator: "CmdOrCtrl+R",
            action: () => callbacksRef.current.onRefresh(),
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await MenuItem.new({
            text: t.menu.file.quit,
            accelerator: "CmdOrCtrl+Q",
            action: () => exit(0),
          }),
        ],
      })

      const langMenu = await Submenu.new({
        text: t.menu.language.title,
        items: [
          await CheckMenuItem.new({
            text: t.menu.language.french,
            checked: lang === "fr",
            action: () => setLang("fr"),
          }),
          await CheckMenuItem.new({
            text: t.menu.language.english,
            checked: lang === "en",
            action: () => setLang("en"),
          }),
        ],
      })

      const displayMenu = await Submenu.new({
        text: t.menu.display.title,
        items: [
          await CheckMenuItem.new({
            text: t.menu.display.lightMode,
            checked: theme === "light",
            action: () => setTheme("light"),
          }),
          await CheckMenuItem.new({
            text: t.menu.display.darkMode,
            checked: theme === "dark",
            action: () => setTheme("dark"),
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await MenuItem.new({
            text: t.menu.display.fullscreen,
            accelerator: "F11",
            action: async () => {
              const win = getCurrentWindow()
              const isFullscreen = await win.isFullscreen()
              await win.setFullscreen(!isFullscreen)
            },
          }),
        ],
      })

      const version = await getVersion()
      const helpMenu = await Submenu.new({
        text: t.menu.help.title,
        items: [
          await PredefinedMenuItem.new({
            text: t.menu.help.about,
            item: {
              About: {
                name: "StayUp",
                version,
                copyright: "© StayUp",
                website: "https://github.com/stayup-app/stayup-desktop",
                websiteLabel: "GitHub",
                authors: ["StayUp"],
                comments: t.menu.help.aboutComment,
              },
            },
          }),
        ],
      })

      if (cancelled) return

      const menu = await Menu.new({ items: [fileMenu, langMenu, displayMenu, helpMenu] })
      await menu.setAsAppMenu()
    }

    buildMenu()
    return () => {
      cancelled = true
    }
  }, [lang, t, theme, setLang, setTheme])
}
