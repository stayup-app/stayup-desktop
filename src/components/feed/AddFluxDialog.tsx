import { useState, useEffect } from "react"
import {
  addUserRepository,
  getConnectorProviders,
  getProviderFluxes,
  subscribeFlux,
} from "@/lib/api"
import type { Instance } from "@/lib/store"
import { decodeToken } from "@/lib/session"
import { useLanguage } from "@/context/LanguageContext"
import { cn } from "@/lib/utils"
import {
  normalizeTemplate,
  buildFluxUrl,
  matchesFormPattern,
  type ProviderTemplate,
} from "@/lib/providerTemplate"
import { providerIcon, providerAccent } from "./providerIcons"
import type { ProviderFlux } from "@/types"

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
  instances: Instance[]
  onSuccess: () => void
}

export function AddFluxDialog({ open, onClose, instances, onSuccess }: AddFluxDialogProps) {
  const { t } = useLanguage()
  const [instanceId, setInstanceId] = useState(instances[0]?.id ?? "")
  const active = instances.find((i) => i.id === instanceId) ?? instances[0]
  const [provider, setProvider] = useState<string>("changelog")
  const [identifier, setIdentifier] = useState("")
  const [pickMode, setPickMode] = useState<"existing" | "new">("existing")
  const [selectedFluxId, setSelectedFluxId] = useState("")
  // null = pas encore chargé, [] = chargé (éventuellement vide)
  const [fluxes, setFluxes] = useState<ProviderFlux[] | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [tiles, setTiles] = useState<ProviderTile[]>([])
  const [tpls, setTpls] = useState<Record<string, ProviderTemplate | null>>({})
  const [approvals, setApprovals] = useState<Record<string, "auto" | "manual">>({})

  useEffect(() => {
    if (!open || !active) return
    let cancelled = false
    getConnectorProviders(active.token, active.url)
      .then((providers) => {
        if (cancelled) return
        const parsed = providers.map((p) => ({ ...p, tpl: normalizeTemplate(p.template) }))
        setTpls(Object.fromEntries(parsed.map((p) => [p.name, p.tpl])))
        setApprovals(Object.fromEntries(parsed.map((p) => [p.name, p.fluxApproval ?? "auto"])))
        setTiles(
          parsed.map(({ name, displayName, tpl }) => {
            const color = providerAccent({
              name,
              displayName: displayName ?? name,
              template: tpl,
            })
            return {
              id: name,
              label:
                tpl?.display?.name ??
                t.feed.providers[name as keyof typeof t.feed.providers] ??
                displayName ??
                name,
              color,
              dim: tpl?.display?.accent ? `${color}22` : "var(--surface-2)",
              icon: providerIcon(tpl?.display ?? undefined),
            }
          }),
        )
      })
      .catch(() => {
        if (!cancelled) {
          setTiles([])
          setTpls({})
          setApprovals({})
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, t, active])

  // Flux existants du provider sélectionné, sur l'instance choisie.
  useEffect(() => {
    if (!open || !active) return
    let cancelled = false
    getProviderFluxes(provider, active.token, active.url)
      .then((list) => {
        if (cancelled) return
        setFluxes(list ?? [])
        setPickMode((list ?? []).some((f) => !f.is_subscribed) ? "existing" : "new")
      })
      .catch(() => {
        if (!cancelled) {
          setFluxes([])
          setPickMode("new")
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, provider, active])

  function handleClose() {
    setInstanceId(instances[0]?.id ?? "")
    setProvider("changelog")
    setIdentifier("")
    setSelectedFluxId("")
    setFluxes(null)
    setError(null)
    setPickMode("existing")
    setPending(false)
    onClose()
  }

  function selectInstance(next: string) {
    setInstanceId(next)
    setProvider("changelog")
    setIdentifier("")
    setSelectedFluxId("")
    setFluxes(null)
    setError(null)
  }

  function selectProvider(next: string) {
    setProvider(next)
    setIdentifier("")
    setSelectedFluxId("")
    setFluxes(null)
    setError(null)
  }

  const currentForm = tpls[provider]?.form

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (pickMode === "existing") {
      if (!selectedFluxId) {
        setError(t.addFlux.selectError)
        return
      }
      setSubmitting(true)
      try {
        if (!active) throw new Error(t.feed.tokenMissing)
        // value = "<dataSourceId>:<id>" ("" pour la base principale de l'instance).
        const [dsPart, idPart] = selectedFluxId.split(":")
        await subscribeFlux(
          provider,
          Number(idPart),
          active.token,
          active.url,
          dsPart ? Number(dsPart) : undefined,
        )
        onSuccess()
        handleClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : t.common.error)
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (!identifier.trim()) {
      setError(t.addFlux.requiredError)
      return
    }
    if (currentForm && !matchesFormPattern(currentForm, identifier)) {
      setError(t.addFlux.requiredError)
      return
    }

    setSubmitting(true)
    try {
      if (!active) throw new Error(t.feed.tokenMissing)
      const targetUserId = decodeToken(active.token).userId

      const url = currentForm ? buildFluxUrl(currentForm, identifier) : identifier
      const result = await addUserRepository(targetUserId, active.token, active.url, {
        provider,
        url,
        config: { max_scraps: 5, retention_days: 15 },
      })
      if (result.status === "pending") {
        setPending(true)
      } else {
        onSuccess()
        handleClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const fluxesLoading = fluxes === null
  const availableFluxes = (fluxes ?? []).filter((f) => !f.is_subscribed)
  const isKnownFeedProvider =
    provider === "changelog" || provider === "youtube" || provider === "rss"
  const inputLabel =
    currentForm?.label ??
    (isKnownFeedProvider
      ? t.addFlux.identifierLabels[provider as "changelog" | "youtube" | "rss"]
      : t.addFlux.identifierLabels.generic)
  const inputPlaceholder =
    currentForm?.placeholder ??
    (isKnownFeedProvider
      ? t.addFlux.placeholders[provider as "changelog" | "youtube" | "rss"]
      : t.addFlux.placeholders.generic)

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
        {!pending && (
          <p className="text-[13px] text-muted-foreground mb-4">{t.addFlux.description}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {pending ? (
            <div className="space-y-2 py-2">
              <p className="text-sm font-medium">{t.addFlux.requestSent}</p>
              <p className="text-sm text-muted-foreground">{t.addFlux.requestSentDescription}</p>
            </div>
          ) : (
            <>
              {instances.length > 1 && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-fg-soft">
                    {t.instances.title}
                  </label>
                  <select
                    value={instanceId}
                    onChange={(e) => selectInstance(e.target.value)}
                    className={inputClass}
                  >
                    {instances.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
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

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPickMode("existing")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    pickMode === "existing"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.addFlux.chooseExisting}
                </button>
                <button
                  type="button"
                  onClick={() => setPickMode("new")}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    pickMode === "new"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.addFlux.makeRequest}
                </button>
              </div>

              {pickMode === "existing" ? (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-fg-soft">
                    {t.addFlux.scrapRepo}
                  </label>
                  {fluxesLoading ? (
                    <p className="text-sm text-muted-foreground">{t.addFlux.loading}</p>
                  ) : (
                    <select
                      value={selectedFluxId}
                      onChange={(e) => setSelectedFluxId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">{t.addFlux.selectScrapRepo}</option>
                      {availableFluxes.length === 0 ? (
                        <option value="" disabled>
                          {t.addFlux.noScrapRepos}
                        </option>
                      ) : (
                        availableFluxes.map((f) => (
                          <option
                            key={`${f.dataSourceId ?? ""}:${f.id}`}
                            value={`${f.dataSourceId ?? ""}:${f.id}`}
                          >
                            {f.url}
                            {f.dataSourceName ? ` — ${f.dataSourceName}` : ""}
                          </option>
                        ))
                      )}
                    </select>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-fg-soft">{inputLabel}</label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={inputPlaceholder}
                    className={inputClass}
                  />
                  {approvals[provider] === "manual" && (
                    <p className="text-[11px] text-muted-foreground">
                      {t.addFlux.requestSentDescription}
                    </p>
                  )}
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
              {pending ? t.addFlux.close : t.addFlux.cancel}
            </button>
            {!pending && (
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
