import { useState, useEffect } from "react"
import {
  addUserRepository,
  createScrapRequest,
  getConnectorProviders,
  getScrapRepos,
  subscribeScrap,
} from "@/lib/api"
import { readApiUrl, readToken } from "@/lib/store"
import { normalizeIdentifier, toRepositoryUrl } from "@/lib/utils"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"
import { isKnownProvider, type KnownProvider } from "@/types"
import type { ScrapRepository } from "@/types"

type FeedProvider = Exclude<KnownProvider, "scrap">

const KNOWN_TILE_STYLE: Record<
  FeedProvider | "scrap",
  { color: string; dim: string; icon: React.ReactNode }
> = {
  changelog: {
    color: "var(--peach)",
    dim: "var(--peach-dim)",
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <path d="M7 1L9.5 4H11.5L7 1ZM7 1L4.5 4H2.5L7 1Z" fill="currentColor" opacity="0.85" />
        <rect x="2" y="4" width="10" height="1" rx="0.5" fill="currentColor" />
        <rect x="3" y="6.5" width="8" height="1" rx="0.5" fill="currentColor" opacity="0.5" />
      </svg>
    ),
  },
  youtube: {
    color: "var(--rose)",
    dim: "var(--rose-dim)",
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="3" width="12" height="8" rx="2" fill="currentColor" />
        <path d="M5.5 5.5L9 7L5.5 8.5V5.5Z" fill="var(--surface)" />
      </svg>
    ),
  },
  rss: {
    color: "var(--sage)",
    dim: "var(--sage-dim)",
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <circle cx="3" cy="11" r="1.5" fill="currentColor" />
        <path
          d="M2 7.5C5 7.5 6.5 9 6.5 11.5"
          stroke="currentColor"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M2 4C7 4 10 7 10 12"
          stroke="currentColor"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  scrap: {
    color: "var(--sky)",
    dim: "var(--sky-dim)",
    icon: (
      <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <ellipse cx="7" cy="7" rx="2" ry="5" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
}

// Style neutre pour tout provider découvert dynamiquement (voir GET /connectors/providers)
// et non connu de cette app.
const GENERIC_TILE_STYLE = {
  color: "var(--muted-foreground)",
  dim: "var(--surface-2)",
  icon: (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  ),
}

interface ProviderTile {
  id: string
  label: string
  color: string
  dim: string
  icon: React.ReactNode
}

interface AddFluxDialogProps {
  open: boolean
  onClose: () => void
  userId: string
  onSuccess: () => void
}

export function AddFluxDialog({ open, onClose, userId, onSuccess }: AddFluxDialogProps) {
  const { t } = useLanguage()
  const [provider, setProvider] = useState<string>("changelog")
  const [identifier, setIdentifier] = useState("")
  const [scrapRepoId, setScrapRepoId] = useState("")
  // null = not yet fetched, [] = fetched (possibly empty)
  const [scrapRepos, setScrapRepos] = useState<ScrapRepository[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scrapMode, setScrapMode] = useState<"select" | "request">("select")
  const [requestUrl, setRequestUrl] = useState("")
  const [requestSuccess, setRequestSuccess] = useState(false)
  const [tiles, setTiles] = useState<ProviderTile[]>([])

  // Liste des providers dynamique : vient de l'API, aucun nom n'est codé en dur ici.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([readToken(), readApiUrl()])
      .then(([token, apiUrl]) => getConnectorProviders(token ?? "", apiUrl))
      .then((providers) => {
        if (cancelled) return
        setTiles(
          providers.map(({ name, displayName }) => {
            const known = isKnownProvider(name) ? KNOWN_TILE_STYLE[name] : GENERIC_TILE_STYLE
            const label =
              name === "scrap"
                ? t.feed.providers.scrap
                : (t.feed.providers[name as KnownProvider] ?? displayName)
            return { id: name, label, ...known }
          }),
        )
      })
      .catch(() => {
        if (!cancelled) setTiles([])
      })
    return () => {
      cancelled = true
    }
  }, [open, t])

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

  function selectProvider(next: string) {
    setProvider(next)
    setIdentifier("")
    setScrapRepoId("")
    setScrapRepos(null)
    setScrapMode("select")
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (provider === "scrap" && scrapMode === "request") {
      if (!requestUrl.trim()) {
        setError(t.addFlux.requiredError)
        return
      }
      try {
        new URL(requestUrl)
      } catch {
        setError(t.addFlux.requestUrlError)
        return
      }
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
      if (!scrapRepoId) {
        setError(t.addFlux.selectError)
        return
      }
    } else {
      if (!identifier.trim()) {
        setError(t.addFlux.requiredError)
        return
      }
    }

    setSubmitting(true)
    try {
      const [token, apiUrl] = await Promise.all([readToken(), readApiUrl()])
      if (!token) throw new Error(t.feed.tokenMissing)

      if (provider === "scrap") {
        await subscribeScrap(Number(scrapRepoId), token, apiUrl)
      } else {
        const normalized = normalizeIdentifier(identifier, provider)
        const url = toRepositoryUrl(normalized, provider)
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
  const isKnownFeedProvider =
    provider === "changelog" || provider === "youtube" || provider === "rss"

  const inputClass =
    "w-full rounded-[10px] border border-border bg-[var(--bg)] text-foreground px-3.5 py-2.5 text-sm focus:outline-none focus:border-peach/70 focus:shadow-peach-ring transition-colors"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        data-testid="dialog-backdrop"
        className="absolute inset-0"
        style={{ background: "rgba(8,10,16,0.72)", backdropFilter: "blur(10px)" }}
        onClick={handleClose}
      />
      <div className="aurora-pop relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-7 shadow-modal">
        <h2 className="font-serif text-[26px] leading-[1.15] tracking-editorial font-normal mb-1">
          {t.addFlux.title}
        </h2>
        {!requestSuccess && (
          <p className="text-[13px] text-muted-foreground mb-4">{t.addFlux.description}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {requestSuccess ? (
            <div className="space-y-2 py-2">
              <p className="text-sm font-medium">{t.addFlux.requestSent}</p>
              <p className="text-sm text-muted-foreground">{t.addFlux.requestSentDescription}</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-fg-soft">{t.addFlux.provider}</label>
                <div className="grid grid-cols-2 gap-2">
                  {tiles.map((tile) => {
                    const active = provider === tile.id
                    return (
                      <button
                        key={tile.id}
                        type="button"
                        onClick={() => selectProvider(tile.id)}
                        className="flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-[13.5px] font-medium transition-colors border"
                        style={
                          active
                            ? { background: tile.dim, borderColor: tile.color, color: "var(--fg)" }
                            : {
                                background: "var(--bg)",
                                borderColor: "var(--border-color)",
                                color: "var(--fg-soft)",
                              }
                        }
                      >
                        <span style={{ color: tile.color }}>{tile.icon}</span>
                        {tile.label}
                      </button>
                    )
                  })}
                </div>
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
                      <label className="text-[11px] font-medium text-fg-soft">
                        {t.addFlux.scrapRepo}
                      </label>
                      {scrapLoading ? (
                        <p className="text-sm text-muted-foreground">{t.addFlux.loading}</p>
                      ) : (
                        <select
                          value={scrapRepoId}
                          onChange={(e) => setScrapRepoId(e.target.value)}
                          className={inputClass}
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
                      <label className="text-[11px] font-medium text-fg-soft">
                        {t.addFlux.requestUrl}
                      </label>
                      <input
                        type="url"
                        value={requestUrl}
                        onChange={(e) => setRequestUrl(e.target.value)}
                        placeholder={t.addFlux.requestUrlPlaceholder}
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-fg-soft">
                    {isKnownFeedProvider
                      ? t.addFlux.identifierLabels[provider as FeedProvider]
                      : t.addFlux.identifierLabels.generic}
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={
                      isKnownFeedProvider
                        ? t.addFlux.placeholders[provider as FeedProvider]
                        : t.addFlux.placeholders.generic
                    }
                    className={inputClass}
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
              className="px-4 py-2 text-sm rounded-md border border-border hover:bg-surface-hi transition-colors"
            >
              {requestSuccess ? t.addFlux.close : t.addFlux.cancel}
            </button>
            {!requestSuccess && (
              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "px-4 py-2 text-sm font-semibold rounded-md bg-peach hover:opacity-95 transition-opacity",
                  submitting && "opacity-50 cursor-not-allowed",
                )}
                style={{ color: "var(--peach-on)" }}
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
