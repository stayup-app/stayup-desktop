import { useState } from "react"
import { Star, Trash2, RefreshCw, Plus } from "lucide-react"
import { useLanguage } from "@/context/LanguageContext"
import { LoginForm } from "@/components/auth/LoginForm"
import { OAuthButtons } from "@/components/auth/OAuthButtons"
import { type AuthConfig, fetchAuthConfig } from "@/lib/api"
import { hostOf } from "@/lib/store"
import type { useAuth } from "@/hooks/useAuth"

interface InstancesModalProps {
  open: boolean
  onClose: () => void
  auth: ReturnType<typeof useAuth>
}

/** Petit formulaire de connexion (mot de passe + OAuth) pointé sur une URL
 *  donnée — sert à ajouter une instance et à en reconnecter une expirée. */
function ConnectForm({
  config,
  loading,
  error,
  onPassword,
  onOAuth,
}: {
  config: AuthConfig | null
  loading: boolean
  error: string | null
  onPassword: (email: string, password: string) => void
  onOAuth: (provider: "github" | "google") => void
}) {
  // API trop ancienne pour /auth/config → on propose tout.
  const oauth = config?.oauth ?? { github: true, google: true }
  return (
    <div className="space-y-3">
      {(oauth.github || oauth.google) && (
        <OAuthButtons
          onOAuth={async (p) => {
            onOAuth(p)
          }}
          loading={loading}
          providers={oauth}
        />
      )}
      <LoginForm
        onSubmit={async (e, p) => {
          onPassword(e, p)
        }}
        loading={loading}
        error={error}
      />
    </div>
  )
}

export function InstancesModal({ open, onClose, auth }: InstancesModalProps) {
  const { t } = useLanguage()
  const {
    instances,
    sessions,
    addInstance,
    reconnectInstance,
    removeInstance,
    renameInstance,
    setPrimary,
  } = auth

  const [adding, setAdding] = useState(false)
  const [url, setUrl] = useState("")
  const [config, setConfig] = useState<AuthConfig | null>(null)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reconnectId, setReconnectId] = useState<string | null>(null)

  if (!open) return null

  const sessionById = new Map(sessions.map((s) => [s.instanceId, s]))

  function resetAdd() {
    setAdding(false)
    setUrl("")
    setConfig(null)
    setChecked(false)
    setError(null)
  }

  async function checkUrl() {
    setBusy(true)
    setError(null)
    setConfig(await fetchAuthConfig(url.trim()).catch(() => null))
    setChecked(true)
    setBusy(false)
  }

  async function runAdd(method: Parameters<typeof addInstance>[1]) {
    setBusy(true)
    setError(null)
    const err = await addInstance(url.trim(), method)
    setBusy(false)
    if (err) setError(err)
    else resetAdd()
  }

  async function runReconnect(id: string, method: Parameters<typeof reconnectInstance>[1]) {
    setBusy(true)
    setError(null)
    const err = await reconnectInstance(id, method)
    setBusy(false)
    if (err) setError(err)
    else setReconnectId(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        data-testid="dialog-backdrop"
        className="absolute inset-0"
        style={{ background: "rgba(8,10,16,0.72)", backdropFilter: "blur(10px)" }}
        onClick={onClose}
      />
      <div className="aurora-pop relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-7 shadow-modal">
        <h2 className="font-serif text-[24px] leading-[1.15] tracking-editorial font-normal">
          {t.instances.title}
        </h2>
        <p className="mt-1 mb-4 text-[13px] text-muted-foreground">{t.instances.subtitle}</p>

        <ul className="space-y-2">
          {instances.map((inst, i) => {
            const s = sessionById.get(inst.id)
            const isPrimary = i === 0
            return (
              <li key={inst.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2">
                  <input
                    defaultValue={inst.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v && v !== inst.name) void renameInstance(inst.id, v)
                    }}
                    aria-label={t.instances.nameLabel}
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium hover:border-border focus:border-border focus:outline-none"
                  />
                  {isPrimary && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[11px]"
                      style={{ background: "var(--peach-dim)", color: "var(--peach-on)" }}
                    >
                      {t.instances.primary}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 px-1 text-[12px] font-mono text-dim">{hostOf(inst.url)}</p>

                {s?.expired && (
                  <p className="mt-1 px-1 text-[12px] text-rose">{t.instances.expired}</p>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  {!isPrimary && (
                    <button
                      type="button"
                      onClick={() => void setPrimary(inst.id)}
                      className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[12px] hover:bg-surface-hi"
                    >
                      <Star className="h-3 w-3" />
                      {t.instances.makePrimary}
                    </button>
                  )}
                  {s?.expired && (
                    <button
                      type="button"
                      onClick={() => setReconnectId(reconnectId === inst.id ? null : inst.id)}
                      className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[12px] hover:bg-surface-hi"
                    >
                      <RefreshCw className="h-3 w-3" />
                      {t.instances.reconnect}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (isPrimary && !window.confirm(t.instances.removePrimaryWarning)) return
                      void removeInstance(inst.id)
                    }}
                    className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[12px] text-rose hover:bg-rose-dim"
                  >
                    <Trash2 className="h-3 w-3" />
                    {t.instances.remove}
                  </button>
                </div>

                {reconnectId === inst.id && (
                  <div className="mt-3 border-t border-border pt-3">
                    <ConnectForm
                      config={null}
                      loading={busy}
                      error={error}
                      onPassword={(e, p) =>
                        void runReconnect(inst.id, { kind: "password", email: e, password: p })
                      }
                      onOAuth={(provider) =>
                        void runReconnect(inst.id, { kind: "oauth", provider })
                      }
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <div className="mt-4">
          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-[13px] hover:bg-surface-hi"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.instances.add}
            </button>
          ) : (
            <div className="rounded-xl border border-border p-3">
              <label className="text-[12px] font-medium text-fg-soft">{t.instances.urlLabel}</label>
              <div className="mt-1 flex gap-2">
                <input
                  autoFocus
                  type="url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value)
                    setChecked(false)
                  }}
                  placeholder={t.instances.urlPlaceholder}
                  className="min-w-0 flex-1 rounded-md border border-border bg-[var(--bg)] px-3 py-2 text-sm focus:border-peach/70 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={busy || !url.trim()}
                  onClick={() => void checkUrl()}
                  className="shrink-0 rounded-md bg-peach px-3 text-sm font-semibold disabled:opacity-50"
                  style={{ color: "var(--peach-on)" }}
                >
                  →
                </button>
              </div>

              {checked && (
                <div className="mt-3">
                  <ConnectForm
                    config={config}
                    loading={busy}
                    error={error}
                    onPassword={(e, p) => void runAdd({ kind: "password", email: e, password: p })}
                    onOAuth={(provider) => void runAdd({ kind: "oauth", provider })}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={resetAdd}
                className="mt-3 text-[12px] text-muted-foreground hover:text-foreground"
              >
                {t.instances.cancel}
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-hi"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  )
}
