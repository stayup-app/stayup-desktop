import { useState } from "react"
import { ChangeEmailForm } from "./ChangeEmailForm"
import { ChangePasswordForm } from "./ChangePasswordForm"
import { useLanguage } from "@/context/LanguageContext"
import type { Instance } from "@/lib/store"
import type { InstanceSession } from "@/hooks/useAuth"

interface ProfileModalProps {
  open: boolean
  onClose: () => void
  sessions: InstanceSession[]
  instances: Instance[]
}

export function ProfileModal({ open, onClose, sessions, instances }: ProfileModalProps) {
  const { t } = useLanguage()
  const [instanceId, setInstanceId] = useState(sessions[0]?.instanceId ?? "")

  if (!open) return null

  const active = sessions.find((s) => s.instanceId === instanceId) ?? sessions[0]
  const token = instances.find((i) => i.id === active?.instanceId)?.token ?? ""

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

        {sessions.length > 1 && (
          <div className="mb-5 space-y-1.5">
            <label className="text-[11px] font-medium text-fg-soft">{t.instances.title}</label>
            <select
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              className="w-full rounded-md border border-border bg-[var(--bg)] px-3 py-2 text-sm"
            >
              {sessions.map((s) => (
                <option key={s.instanceId} value={s.instanceId}>
                  {s.instanceName} — {s.email}
                </option>
              ))}
            </select>
          </div>
        )}

        {active && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div>
                <h3 className="text-sm font-medium">{t.profile.email}</h3>
                <p className="text-xs text-muted-foreground">{t.profile.emailDescription}</p>
              </div>
              <ChangeEmailForm
                key={`email-${active.instanceId}`}
                userId={active.userId}
                currentEmail={active.email}
                token={token}
                apiUrl={active.instanceUrl}
              />
            </div>

            <div className="h-px bg-border" />

            <div className="space-y-2">
              <div>
                <h3 className="text-sm font-medium">{t.profile.password}</h3>
                <p className="text-xs text-muted-foreground">{t.profile.passwordDescription}</p>
              </div>
              <ChangePasswordForm
                key={`pw-${active.instanceId}`}
                userId={active.userId}
                token={token}
                apiUrl={active.instanceUrl}
              />
            </div>
          </div>
        )}

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
