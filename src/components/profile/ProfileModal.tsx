import { ChangeEmailForm } from "./ChangeEmailForm"
import { ChangePasswordForm } from "./ChangePasswordForm"
import { useLanguage } from "@/context/LanguageContext"
import type { AppSession } from "@/lib/session"

interface ProfileModalProps {
  open: boolean
  onClose: () => void
  session: AppSession
}

export function ProfileModal({ open, onClose, session }: ProfileModalProps) {
  const { t } = useLanguage()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h2 className="text-base font-semibold mb-4">{t.profile.title}</h2>

        <div className="space-y-5">
          <div className="space-y-2">
            <div>
              <h3 className="text-sm font-medium">{t.profile.email}</h3>
              <p className="text-xs text-muted-foreground">{t.profile.emailDescription}</p>
            </div>
            <ChangeEmailForm userId={session.userId} currentEmail={session.email} />
          </div>

          <div className="h-px bg-border" />

          <div className="space-y-2">
            <div>
              <h3 className="text-sm font-medium">{t.profile.password}</h3>
              <p className="text-xs text-muted-foreground">{t.profile.passwordDescription}</p>
            </div>
            <ChangePasswordForm userId={session.userId} />
          </div>
        </div>

        <div className="flex justify-end pt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  )
}
