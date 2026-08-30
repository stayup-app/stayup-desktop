import { useState } from "react"
import { ChevronDown, ChevronRight, LayoutList, Plus, RefreshCw, Trash2 } from "lucide-react"
import { cn, providerDisplayName, stripUrlScheme } from "@/lib/utils"
import { useNavigationStore } from "@/store/navigation"
import { useLanguage } from "@/context/LanguageContext"
import { AddFluxDialog } from "./AddFluxDialog"
import { ImportExportButtons } from "./ImportExportButtons"
import { deleteUserRepository } from "@/lib/api"
import { decodeToken } from "@/lib/session"
import type { Instance } from "@/lib/store"
import { providerIcon, providerAccent } from "./providerIcons"
import type { ProviderMeta } from "@/lib/providerTemplate"
import type { FeedFlux } from "@/hooks/useFeed"
import type { Provider } from "@/types"

/** Métadonnées d'un provider pour la sidebar, dérivées de son template. */
function getProviderMeta(provider: Provider, templates: Record<string, ProviderMeta>) {
  const meta = templates[provider]
  const color = providerAccent(meta)
  return {
    label: meta?.template?.display?.name || meta?.displayName || providerDisplayName(provider),
    color,
    dimColor: meta?.template?.display?.accent ? `${color}22` : "var(--surface-2)",
    icon: providerIcon(meta?.template?.display),
  }
}

interface FeedSidebarProps {
  fluxes: FeedFlux[]
  templates: Record<string, ProviderMeta>
  /** L'instance primaire ; sert d'`userId` par défaut à l'import OPML. */
  userId: string
  instances: Instance[]
  onRefresh: () => void
  loading?: boolean
  unreadCountByRepoId?: Record<string, number>
  width?: number
}

export function FeedSidebar({
  fluxes,
  templates,
  userId,
  instances,
  onRefresh,
  loading = false,
  unreadCountByRepoId = {},
  width = 220,
}: FeedSidebarProps) {
  const { selection, setSelection } = useNavigationStore()
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [addOpen, setAddOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<FeedFlux | null>(null)

  const byProvider = fluxes.reduce<Partial<Record<Provider, FeedFlux[]>>>((acc, flux) => {
    ;(acc[flux.provider] ??= []).push(flux)
    return acc
  }, {})

  const providers = Object.keys(byProvider) as Provider[]
  // Badge d'instance sur chaque flux dès qu'il y en a plus d'une.
  const multiInstance = new Set(fluxes.map((f) => f.instanceId)).size > 1
  const unreadKey = (f: FeedFlux) => `${f.instanceId ?? ""}:${f.repository_id}`

  function isExpanded(provider: Provider) {
    return expanded[provider] !== false
  }

  function toggleExpanded(provider: Provider) {
    setExpanded((prev) => ({ ...prev, [provider]: !isExpanded(provider) }))
  }

  function handleDeleteClick(flux: FeedFlux, e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmTarget(flux)
  }

  async function handleDeleteConfirm() {
    if (!confirmTarget) return
    const flux = confirmTarget
    setConfirmTarget(null)
    setDeleting(flux.id)
    try {
      const inst = instances.find((i) => i.id === flux.instanceId)
      if (!inst) throw new Error(t.feed.tokenMissing)
      await deleteUserRepository(decodeToken(inst.token).userId, flux.id, inst.token, inst.url)
      onRefresh()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <aside className="shrink-0 overflow-y-auto" style={{ width, minWidth: 120, maxWidth: 500 }}>
      <div className="px-3 pt-2">
        {/* All feed */}
        <button
          onClick={() => setSelection({ type: "all" })}
          className={cn(
            "flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-[15px] transition-colors mb-3",
            selection.type === "all"
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
          style={selection.type === "all" ? { background: "var(--surface-3)" } : undefined}
        >
          <LayoutList className="h-3.5 w-3.5 shrink-0" />
          <span>{t.feed.allFeeds}</span>
        </button>

        {/* My feeds section */}
        <div className="flex items-center justify-between mb-2 px-2">
          <span
            className="text-[12px] font-mono font-semibold uppercase tracking-widest"
            style={{ color: "var(--dim)" }}
          >
            {t.feed.myFeeds}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              style={{ border: "1px solid hsl(var(--border))" }}
              aria-label={t.menu.file.refresh}
              title={t.menu.file.refresh}
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
              style={{ border: "1px solid hsl(var(--border))" }}
              aria-label={t.addFlux.title}
              title={t.addFlux.title}
            >
              <Plus className="h-3 w-3" />
            </button>
            <ImportExportButtons fluxes={fluxes} userId={userId} onSuccess={onRefresh} />
          </div>
        </div>

        {/* Provider groups */}
        <nav className="space-y-0.5">
          {providers.map((provider) => {
            const meta = getProviderMeta(provider, templates)
            const isCategoryActive =
              selection.type === "category" && selection.provider === provider
            const open = isExpanded(provider)
            const providerFluxes = byProvider[provider] ?? []
            const totalUnread = providerFluxes.reduce(
              (sum, flux) => sum + (unreadCountByRepoId[unreadKey(flux)] ?? 0),
              0,
            )

            return (
              <div key={provider}>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => toggleExpanded(provider)}
                    className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                  >
                    {open ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    onClick={() => setSelection({ type: "category", provider })}
                    className={cn(
                      "flex flex-1 items-center gap-2 px-2 py-1.5 text-[15px] rounded-md transition-colors",
                      isCategoryActive
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    style={isCategoryActive ? { background: "var(--surface-3)" } : undefined}
                  >
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                    <span className="truncate flex-1">{meta.label}</span>
                    {totalUnread > 0 && (
                      <span
                        className="text-[12px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: meta.dimColor, color: meta.color }}
                      >
                        {totalUnread}
                      </span>
                    )}
                  </button>
                </div>

                {open && (
                  <div className="ml-7 mt-0.5 space-y-0.5 mb-1">
                    {providerFluxes.map((flux) => {
                      const isActive =
                        selection.type === "flux" &&
                        selection.fluxId === flux.id &&
                        selection.instanceId === flux.instanceId
                      const fluxUnread = unreadCountByRepoId[unreadKey(flux)] ?? 0
                      return (
                        <div
                          key={flux.id}
                          className={cn(
                            "group flex items-center rounded-md transition-colors",
                            isActive ? "" : "hover:bg-accent",
                          )}
                          style={isActive ? { background: "var(--surface-3)" } : undefined}
                        >
                          {isActive && (
                            <div
                              className="w-0.5 h-4 rounded-full mr-1 shrink-0"
                              style={{ background: meta.color }}
                            />
                          )}
                          <button
                            onClick={() =>
                              setSelection({
                                type: "flux",
                                fluxId: flux.id,
                                provider: flux.provider,
                                instanceId: flux.instanceId,
                              })
                            }
                            className={cn(
                              "flex flex-1 items-center gap-1 px-2 py-1 text-[14px] font-mono text-left min-w-0",
                              isActive
                                ? "text-foreground font-medium"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            <span className="truncate">{stripUrlScheme(flux.identifier)}</span>
                            {multiInstance && (
                              <span
                                className="shrink-0 rounded bg-[var(--surface-2)] px-1 text-[10px] text-dim"
                                title={flux.instanceName}
                              >
                                {flux.instanceName}
                              </span>
                            )}
                            {fluxUnread > 0 && (
                              <span
                                className="text-[12px] font-mono px-1 rounded shrink-0"
                                style={{ background: meta.dimColor, color: meta.color }}
                              >
                                {fluxUnread}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(flux, e)}
                            disabled={deleting === flux.id}
                            className="shrink-0 p-1 mr-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity disabled:opacity-50"
                            aria-label={t.feed.deleteAriaLabel}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </div>

      <AddFluxDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        instances={instances}
        onSuccess={onRefresh}
      />

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            data-testid="dialog-backdrop"
            className="absolute inset-0"
            style={{ background: "rgba(8,10,16,0.72)", backdropFilter: "blur(10px)" }}
            onClick={() => setConfirmTarget(null)}
          />
          <div className="aurora-pop relative z-10 w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-modal">
            <p className="text-sm mb-4 text-fg-soft">
              {t.feed.confirmDelete.replace("{id}", confirmTarget.identifier)}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-surface-hi transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="rounded-md bg-destructive px-4 py-1.5 text-sm font-semibold hover:opacity-90 transition-opacity"
                style={{ color: "var(--rose-on)" }}
              >
                {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
