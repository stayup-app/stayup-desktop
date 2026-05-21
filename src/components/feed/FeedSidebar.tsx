import { useState } from "react"
import { ChevronDown, ChevronRight, LayoutList, BookOpen, Plus, Trash2 } from "lucide-react"
import { cn, stripUrlScheme } from "@/lib/utils"
import { useNavigationStore } from "@/store/navigation"
import { useLanguage } from "@/context/LanguageContext"
import { AddFluxDialog } from "./AddFluxDialog"
import { deleteUserRepository } from "@/lib/api"
import { readToken, readApiUrl } from "@/lib/store"
import type { FeedFlux } from "@/hooks/useFeed"
import type { Provider } from "@/types"

const PROVIDER_META: Record<
  Provider,
  { label: string; color: string; dimColor: string; icon: React.ReactNode }
> = {
  changelog: {
    label: "GitHub Changelog",
    color: "var(--teal)",
    dimColor: "var(--teal-dim)",
    icon: (
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M7 1L9.5 4H11.5L7 1ZM7 1L4.5 4H2.5L7 1Z" fill="currentColor" opacity="0.8" />
        <rect x="2" y="4" width="10" height="1" rx="0.5" fill="currentColor" />
        <rect x="3" y="6.5" width="8" height="1" rx="0.5" fill="currentColor" opacity="0.5" />
        <rect x="3" y="8.5" width="6" height="1" rx="0.5" fill="currentColor" opacity="0.5" />
      </svg>
    ),
  },
  youtube: {
    label: "YouTube",
    color: "var(--rose)",
    dimColor: "var(--rose-dim)",
    icon: (
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="3" width="12" height="8" rx="2" fill="currentColor" />
        <path d="M5.5 5.5L9 7L5.5 8.5V5.5Z" fill="white" />
      </svg>
    ),
  },
  rss: {
    label: "RSS",
    color: "var(--amber)",
    dimColor: "var(--amber-dim)",
    icon: (
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <circle cx="3" cy="11" r="1.5" fill="currentColor" />
        <path
          d="M2 7.5C5 7.5 6.5 9 6.5 11.5"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M2 4C7 4 10 7 10 12"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  scrap: {
    label: "Web Scraping",
    color: "var(--green)",
    dimColor: "var(--green-dim)",
    icon: (
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <ellipse cx="7" cy="7" rx="2" ry="5" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ),
  },
  documentation: {
    label: "Documentation",
    color: "var(--indigo)",
    dimColor: "var(--indigo-dim)",
    icon: (
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <rect
          x="2"
          y="1"
          width="9"
          height="12"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
        />
        <rect x="4" y="4" width="5" height="1" rx="0.5" fill="currentColor" opacity="0.7" />
        <rect x="4" y="6.5" width="5" height="1" rx="0.5" fill="currentColor" opacity="0.5" />
        <rect x="4" y="9" width="3" height="1" rx="0.5" fill="currentColor" opacity="0.5" />
      </svg>
    ),
  },
}

interface FeedSidebarProps {
  fluxes: FeedFlux[]
  userId: string
  onRefresh: () => void
  unreadCountByRepoId?: Record<number, number>
  width?: number
}

export function FeedSidebar({
  fluxes,
  userId,
  onRefresh,
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
      const [token, apiUrl] = await Promise.all([readToken(), readApiUrl()])
      if (!token) throw new Error(t.feed.tokenMissing)
      await deleteUserRepository(userId, flux.id, token, apiUrl)
      onRefresh()
    } finally {
      setDeleting(null)
    }
  }

  const isDocActive =
    selection.type === "documentation" ||
    selection.type === "doc" ||
    selection.type === "doc-history" ||
    selection.type === "doc-diff"

  return (
    <aside className="shrink-0 overflow-y-auto" style={{ width, minWidth: 120, maxWidth: 500 }}>
      <div className="px-3 pt-2">
        {/* All feed */}
        <button
          onClick={() => setSelection({ type: "all" })}
          className={cn(
            "flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-[15px] transition-colors mb-1",
            selection.type === "all"
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
          style={selection.type === "all" ? { background: "var(--surface-3)" } : undefined}
        >
          <LayoutList className="h-3.5 w-3.5 shrink-0" />
          <span>{t.feed.allFeeds}</span>
        </button>

        {/* Documentation */}
        <button
          onClick={() => setSelection({ type: "documentation" })}
          className={cn(
            "flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-[15px] transition-colors mb-3",
            isDocActive
              ? "text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
          style={isDocActive ? { background: "var(--surface-3)" } : undefined}
        >
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          <span>{t.documentation.myDocs}</span>
        </button>

        {/* My feeds section */}
        <div className="flex items-center justify-between mb-2 px-2">
          <span
            className="text-[12px] font-mono font-semibold uppercase tracking-widest"
            style={{ color: "var(--dim)" }}
          >
            {t.feed.myFeeds}
          </span>
          <button
            onClick={() => setAddOpen(true)}
            className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
            style={{ border: "1px solid hsl(var(--border))" }}
            aria-label={t.addFlux.title}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        {/* Provider groups */}
        <nav className="space-y-0.5">
          {providers.map((provider) => {
            const meta = PROVIDER_META[provider]
            const isCategoryActive =
              selection.type === "category" && selection.provider === provider
            const open = isExpanded(provider)
            const providerFluxes = byProvider[provider] ?? []
            const totalUnread = providerFluxes.reduce(
              (sum, flux) => sum + (unreadCountByRepoId[flux.repository_id] ?? 0),
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
                      const isActive = selection.type === "flux" && selection.fluxId === flux.id
                      const fluxUnread = unreadCountByRepoId[flux.repository_id] ?? 0
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
        userId={userId}
        onSuccess={onRefresh}
      />

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
            <p className="text-sm mb-4">
              {t.feed.confirmDelete.replace("{id}", confirmTarget.identifier)}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-muted transition-colors"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="rounded-md bg-destructive px-4 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90 transition-colors"
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
