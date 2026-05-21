import { useState } from "react"
import { useNavigationStore } from "@/store/navigation"
import { useLanguage } from "@/context/LanguageContext"
import { useDocumentation } from "@/hooks/useDocumentation"
import { createDocRequest } from "@/lib/api"
import { readToken, readApiUrl } from "@/lib/store"
import { cn } from "@/lib/utils"

function DocRequestDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage()
  const [url, setUrl] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const [token, apiUrl] = await Promise.all([readToken(), readApiUrl()])
      if (!token) throw new Error(t.common.error)
      await createDocRequest({ url }, token, apiUrl)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h2 className="text-base font-semibold mb-4">{t.documentation.requestTitle}</h2>

        {success ? (
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium">{t.documentation.requestSuccess}</p>
            <p className="text-sm text-muted-foreground">{t.documentation.requestSuccessDesc}</p>
            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                {t.addFlux.cancel}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t.documentation.requestUrlLabel}</label>
              <input
                required
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t.documentation.requestUrlPlaceholder}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                {t.addFlux.cancel}
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {pending ? "…" : t.documentation.requestSubmit}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export function DocList() {
  const { t } = useLanguage()
  const { setSelection } = useNavigationStore()
  const { docs, loading, error, subscribe, unsubscribe } = useDocumentation()
  const [requestOpen, setRequestOpen] = useState(false)

  const header = (
    <div className="flex items-center justify-between mb-4">
      <span />
      <button
        onClick={() => setRequestOpen(true)}
        className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
      >
        {t.documentation.requestBtn}
      </button>
    </div>
  )

  if (loading) {
    return (
      <>
        {header}
        <p className="text-sm text-muted-foreground italic py-12 text-center">
          {t.documentation.loading}
        </p>
        {requestOpen && <DocRequestDialog onClose={() => setRequestOpen(false)} />}
      </>
    )
  }

  if (error) {
    return (
      <>
        {header}
        <p className="text-sm text-destructive py-12 text-center">{error}</p>
        {requestOpen && <DocRequestDialog onClose={() => setRequestOpen(false)} />}
      </>
    )
  }

  if (docs.length === 0) {
    return (
      <>
        {header}
        <p className="text-sm text-muted-foreground italic py-12 text-center">
          {t.documentation.noContent}
        </p>
        {requestOpen && <DocRequestDialog onClose={() => setRequestOpen(false)} />}
      </>
    )
  }

  return (
    <>
      {header}
      {requestOpen && <DocRequestDialog onClose={() => setRequestOpen(false)} />}
      <div className="grid gap-4 sm:grid-cols-2">
        {docs.map((doc) => (
          <div key={doc.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="space-y-1">
              <h3 className="font-medium text-sm">{doc.name}</h3>
              <p className="text-xs text-muted-foreground truncate">{doc.url}</p>
              {doc.current_version !== null && (
                <p className="text-xs text-muted-foreground">
                  {t.documentation.version} {doc.current_version}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelection({ type: "doc", docId: doc.id })}
                className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors"
              >
                {t.documentation.viewContent}
              </button>
              <button
                onClick={() => setSelection({ type: "doc-history", docId: doc.id })}
                className="text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted transition-colors"
              >
                {t.documentation.viewHistory}
              </button>
              <button
                onClick={() => (doc.is_subscribed ? unsubscribe(doc.id) : subscribe(doc.id))}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-md transition-colors ml-auto",
                  doc.is_subscribed
                    ? "bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {doc.is_subscribed ? t.documentation.unsubscribe : t.documentation.subscribe}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
