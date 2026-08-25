import { useState, useRef, useEffect } from "react"
import { User, LogOut } from "lucide-react"
import { useLanguage } from "@/context/LanguageContext"
import type { AppSession } from "@/lib/session"

interface UserMenuProps {
  session: AppSession
  onLogout: () => void
  onOpenProfile: () => void
}

export function UserMenu({ session, onLogout, onOpenProfile }: UserMenuProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const initial = session.name?.charAt(0)?.toUpperCase() ?? "?"

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={session.name}
        className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-semibold transition-opacity hover:opacity-90"
        style={{
          background: "linear-gradient(135deg, var(--peach), var(--lavender))",
          color: "var(--peach-on)",
        }}
      >
        {initial}
      </button>

      {open && (
        <div className="aurora-pop absolute right-0 top-[calc(100%+8px)] z-50 w-[180px] rounded-xl border border-border bg-surface p-1.5 shadow-menu">
          <button
            onClick={() => {
              setOpen(false)
              onOpenProfile()
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13px] transition-colors hover:bg-surface-hi hover:text-foreground"
            style={{ color: "var(--fg-soft)" }}
          >
            <User className="h-3.5 w-3.5" />
            {t.userMenu.profile}
          </button>
          <button
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[13px] transition-colors"
            style={{ color: "var(--fg-soft)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--rose)"
              e.currentTarget.style.background = "var(--rose-dim)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--fg-soft)"
              e.currentTarget.style.background = "transparent"
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            {t.userMenu.signOut}
          </button>
        </div>
      )}
    </div>
  )
}
