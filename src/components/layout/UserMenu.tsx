import { useLanguage } from "@/context/LanguageContext"
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher"
import type { AppSession } from "@/lib/session"

interface UserMenuProps {
  session: AppSession
  onLogout: () => void
  onOpenProfile: () => void
}

export function UserMenu({ session, onLogout, onOpenProfile }: UserMenuProps) {
  const { t } = useLanguage()

  return (
    <div className="flex items-center gap-3">
      <LanguageSwitcher />
      <button
        onClick={onOpenProfile}
        title={t.userMenu.profile}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate max-w-[160px]"
      >
        {session.email}
      </button>
      <button
        onClick={onLogout}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {t.userMenu.signOut}
      </button>
    </div>
  )
}
