import { ChangeEmailForm } from "./ChangeEmailForm"
import { ChangePasswordForm } from "./ChangePasswordForm"
import { ApiUrlForm } from "./ApiUrlForm"
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
      <div
        data-testid="dialog-backdrop"
        className="absolute inset-0"
        style={{ background: "rgba(8,10,16,0.72)", backdropFilter: "blur(10px)" }}
        onClick={onClose}
      />
      <div className="aurora-pop relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-7 shadow-modal">
        <h2 className="font-serif text-[24px] leading-[1.15] tracking-editorial font-normal mb-4">
          {t.profile.title}
        </h2>

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

          <div className="h-px bg-border" />

          <div className="space-y-2">
            <div>
              <h3 className="text-sm font-medium">{t.profile.apiUrl}</h3>
              <p className="text-xs text-muted-foreground">{t.profile.apiUrlDescription}</p>
            </div>
            <ApiUrlForm />
          </div>
        </div>

        <div className="flex justify-end pt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-border hover:bg-surface-hi transition-colors"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  )
}
