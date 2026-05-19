import { useState, useEffect } from "react"
import { addUserRepository, createScrapRequest, getScrapRepos, subscribeScrap } from "@/lib/api"
import { readApiUrl, readToken } from "@/lib/store"
import { normalizeIdentifier, toRepositoryUrl } from "@/lib/utils"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"
import type { Provider } from "@/types"
import type { ScrapRepository } from "@/types"

type FeedProvider = "changelog" | "youtube" | "rss"

interface AddFluxDialogProps {
  open: boolean
  onClose: () => void
  userId: string
  onSuccess: () => void
}

export function AddFluxDialog({ open, onClose, userId, onSuccess }: AddFluxDialogProps) {
  const { t } = useLanguage()
  const [provider, setProvider] = useState<Provider>("changelog")
  const [identifier, setIdentifier] = useState("")
  const [scrapRepoId, setScrapRepoId] = useState("")
  // null = not yet fetched, [] = fetched (possibly empty)
  const [scrapRepos, setScrapRepos] = useState<ScrapRepository[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scrapMode, setScrapMode] = useState<"select" | "request">("select")
  const [requestUrl, setRequestUrl] = useState("")
  const [requestSuccess, setRequestSuccess] = useState(false)

  useEffect(() => {
    if (provider !== "scrap") return
    let cancelled = false
    Promise.all([readToken(), readApiUrl()])
      .then(([token, apiUrl]) => {
        if (cancelled || !token) return []
        return getScrapRepos(token, apiUrl)
      })
      .then((repos) => {
        if (!cancelled) setScrapRepos(repos ?? [])
      })
      .catch(() => {
        if (!cancelled) setScrapRepos([])
      })
    return () => {
      cancelled = true
    }
  }, [provider])

  function handleClose() {
    setProvider("changelog")
    setIdentifier("")
    setScrapRepoId("")
    setScrapRepos(null)
    setError(null)
    setScrapMode("select")
    setRequestUrl("")
    setRequestSuccess(false)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (provider === "scrap" && scrapMode === "request") {
      if (!requestUrl.trim()) { setError(t.addFlux.requiredError); return }
      try { new URL(requestUrl) } catch { setError(t.addFlux.requestUrlError); return }
      setSubmitting(true)
      try {
        const [token, apiUrl] = await Promise.all([readToken(), readApiUrl()])
        if (!token) throw new Error(t.feed.tokenMissing)
        await createScrapRequest({ url: requestUrl }, token, apiUrl)
        setRequestSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : t.common.error)
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (provider === "scrap") {
      if (!scrapRepoId) { setError(t.addFlux.selectError); return }
    } else {
      if (!identifier.trim()) { setError(t.addFlux.requiredError); return }
    }

    setSubmitting(true)
    try {
      const [token, apiUrl] = await Promise.all([readToken(), readApiUrl()])
      if (!token) throw new Error(t.feed.tokenMissing)

      if (provider === "scrap") {
        await subscribeScrap(Number(scrapRepoId), token, apiUrl)
      } else {
        const normalized = normalizeIdentifier(identifier, provider as FeedProvider)
        const url = toRepositoryUrl(normalized, provider as FeedProvider)
        await addUserRepository(userId, token, apiUrl, {
          provider,
          url,
          config: { max_scraps: 5, retention_days: 15 },
        })
      }

      onSuccess()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const scrapLoading = provider === "scrap" && scrapRepos === null
  const availableScrapRepos = (scrapRepos ?? []).filter((r) => !r.is_subscribed)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h2 className="text-base font-semibold mb-1">{t.addFlux.title}</h2>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {requestSuccess ? (
            <div className="space-y-2 py-2">
              <p className="text-sm font-medium">{t.addFlux.requestSent}</p>
              <p className="text-sm text-muted-foreground">{t.addFlux.requestSentDescription}</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t.addFlux.provider}</label>
                <select
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value as Provider)
                    setIdentifier("")
                    setScrapRepoId("")
                    setScrapRepos(null)
                    setScrapMode("select")
                    setError(null)
                  }}
                  className="w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="changelog">{t.feed.providers.changelog}</option>
                  <option value="youtube">{t.feed.providers.youtube}</option>
                  <option value="rss">{t.feed.providers.rss}</option>
                  <option value="scrap">{t.feed.providers.scrap}</option>
                </select>
              </div>

              {provider === "scrap" ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setScrapMode("select")}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        scrapMode === "select"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.addFlux.chooseExisting}
                    </button>
                    <button
                      type="button"
                      onClick={() => setScrapMode("request")}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        scrapMode === "request"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.addFlux.makeRequest}
                    </button>
                  </div>

                  {scrapMode === "select" ? (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">{t.addFlux.scrapRepo}</label>
                      {scrapLoading ? (
                        <p className="text-sm text-muted-foreground">{t.addFlux.loading}</p>
                      ) : (
                        <select
                          value={scrapRepoId}
                          onChange={(e) => setScrapRepoId(e.target.value)}
                          className="w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="">{t.addFlux.selectScrapRepo}</option>
                          {availableScrapRepos.length === 0 ? (
                            <option value="" disabled>
                              {t.addFlux.noScrapRepos}
                            </option>
                          ) : (
                            availableScrapRepos.map((r) => (
                              <option key={r.id} value={String(r.id)}>
                                {r.url}
                              </option>
                            ))
                          )}
                        </select>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">{t.addFlux.requestUrl}</label>
                      <input
                        type="url"
                        value={requestUrl}
                        onChange={(e) => setRequestUrl(e.target.value)}
                        placeholder={t.addFlux.requestUrlPlaceholder}
                        className="w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {t.addFlux.identifierLabels[provider as FeedProvider]}
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={t.addFlux.placeholders[provider as FeedProvider]}
                    className="w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
            >
              {t.addFlux.cancel}
            </button>
            {!requestSuccess && (
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
                  submitting && "opacity-50 cursor-not-allowed",
                )}
              >
                {submitting ? t.addFlux.adding : t.addFlux.add}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
