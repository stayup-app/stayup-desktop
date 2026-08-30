import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react"
import { CheckCheck } from "lucide-react"
import { useNavigationStore } from "@/store/navigation"
import { useReadItemsStore, getTaggedItemId } from "@/store/readItems"
import { useFeed } from "@/hooks/useFeed"
import { useMenu } from "@/hooks/useMenu"
import { useLanguage } from "@/context/LanguageContext"
import { useTheme } from "@/context/ThemeContext"
import { FeedSidebar } from "./FeedSidebar"
import { UnifiedFeedList } from "./UnifiedFeedList"
import { FeedContentViewer } from "./FeedContentViewer"
import { UserMenu } from "@/components/layout/UserMenu"
import { ProfileModal } from "@/components/profile/ProfileModal"
import { InstancesModal } from "@/components/instances/InstancesModal"
import { AuroraWordmark } from "@/components/ui/AuroraMark"
import { cn } from "@/lib/utils"
import { openUrl } from "@/lib/utils"
import { resolveOpenUrl, type ProviderMeta } from "@/lib/providerTemplate"
import type { UserFeedResponse } from "@/lib/api"
import type { useAuth } from "@/hooks/useAuth"
import type { TaggedItem } from "@/types"

interface FeedLayoutProps {
  auth: ReturnType<typeof useAuth>
  onCheckUpdates: () => void
}

type FilterMode = "all" | "unread"

function getItemDate(tagged: TaggedItem): string {
  const item = tagged.item
  if ("datetime" in item && item.datetime) return item.datetime
  return item.executed_at
}

/** Aplati les connecteurs découverts dynamiquement en une seule liste taguée. */
function flattenConnectors(connectors: UserFeedResponse["connectors"]): TaggedItem[] {
  return Object.entries(connectors).flatMap(([provider, items]) =>
    items.map((item) => ({ provider, item }) as TaggedItem),
  )
}

/** Lien externe d'une ligne pour la touche Entrée : résolu depuis le template du
 *  connecteur (aucune règle par-provider ici). */
/** Clé de source : `<instanceId>:<repository_id>` — un repository_id n'est unique
 *  qu'au sein d'une instance. */
function sourceKey(instanceId: unknown, repositoryId: unknown): string {
  return `${typeof instanceId === "string" ? instanceId : ""}:${repositoryId}`
}

function getItemExternalUrl(
  tagged: TaggedItem,
  templates: Record<string, ProviderMeta>,
  sourceMap: Record<string, Record<string, unknown>>,
): string | null {
  const tpl = templates[tagged.provider]?.template
  if (!tpl) return null
  return resolveOpenUrl(
    tpl,
    tagged.item as Record<string, unknown>,
    sourceMap[sourceKey(tagged.item._instance_id, tagged.item.repository_id)],
  )
}

export function FeedLayout({ auth, onCheckUpdates }: FeedLayoutProps) {
  // App ne rend FeedLayout qu'une fois `session` non nulle.
  const session = auth.session as NonNullable<typeof auth.session>
  const onLogout = auth.logout
  const { selection } = useNavigationStore()
  const { readIds, initialized, init, markRead, markAllRead, cleanup } = useReadItemsStore()
  const { fluxes, connectors, templates, instanceErrors, loading, error, refresh } = useFeed(
    auth.instances,
  )
  const { lang, t, setLang } = useLanguage()
  const { theme, setTheme } = useTheme()
  const listContainerRef = useRef<HTMLDivElement>(null)

  const [sidebarWidth, setSidebarWidth] = useState(220)
  const [listWidth, setListWidth] = useState(380)
  const [profileOpen, setProfileOpen] = useState(false)
  const [instancesOpen, setInstancesOpen] = useState(false)

  const handleSidebarDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = sidebarWidth
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      const onMove = (ev: MouseEvent) => {
        setSidebarWidth(Math.max(150, Math.min(420, startWidth + (ev.clientX - startX))))
      }
      const onUp = () => {
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
      }
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    },
    [sidebarWidth],
  )

  const handleListDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = listWidth
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      const onMove = (ev: MouseEvent) => {
        setListWidth(Math.max(260, Math.min(600, startWidth + (ev.clientX - startX))))
      }
      const onUp = () => {
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup", onUp)
      }
      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup", onUp)
    },
    [listWidth],
  )

  useEffect(() => {
    void init(auth.instances[0]?.id)
  }, [init, auth.instances])

  const stableRefresh = useCallback(() => refresh(), [refresh])

  useMenu({
    lang,
    t,
    theme,
    setLang,
    setTheme,
    onCheckUpdates,
    onRefresh: stableRefresh,
  })

  const repositories = useMemo(
    () =>
      fluxes.map((f) => ({
        repository_id: f.repository_id,
        url: f.url,
        provider: f.provider,
        instanceId: f.instanceId,
      })),
    [fluxes],
  )

  const sourceMap = useMemo(
    () =>
      Object.fromEntries(
        fluxes.map((f) => [
          sourceKey(f.instanceId, f.repository_id),
          { url: f.url, type: f.provider, config: {} },
        ]),
      ),
    [fluxes],
  )

  const selectionId = useMemo(() => {
    if (selection.type === "category") return `category:${selection.provider}`
    if (selection.type === "flux") return `flux:${selection.fluxId}`
    return selection.type
  }, [selection])

  const [filterState, setFilterState] = useState<{ selectionId: string; mode: FilterMode }>({
    selectionId: "",
    mode: "all",
  })
  const filterMode = filterState.selectionId === selectionId ? filterState.mode : "all"

  // Track open item by ID (not index) so selection stays stable when filteredItems shrinks
  const [openState, setOpenState] = useState<{ selectionId: string; itemId: string | null }>({
    selectionId: "",
    itemId: null,
  })
  const openItemId = openState.selectionId === selectionId ? openState.itemId : null

  const sortedItems = useMemo((): TaggedItem[] => {
    if (!connectors) return []

    let raw: TaggedItem[] = []

    if (selection.type === "all") {
      raw = flattenConnectors(connectors)
    } else if (selection.type === "category") {
      const { provider } = selection
      const items = connectors[provider] ?? []
      raw = items.map((item) => ({ provider, item }) as TaggedItem)
    } else if (selection.type === "flux") {
      const { fluxId, provider, instanceId } = selection
      const flux = fluxes.find((f) => f.id === fluxId && f.instanceId === instanceId)
      const repoId = flux?.repository_id
      const allItems = connectors[provider] ?? []
      const filtered = repoId
        ? allItems.filter((i) => i.repository_id === repoId && i._instance_id === instanceId)
        : allItems
      raw = filtered.map((item) => ({ provider, item }) as TaggedItem)
    }

    return raw.sort(
      (a, b) => new Date(getItemDate(b)).getTime() - new Date(getItemDate(a)).getTime(),
    )
  }, [connectors, selection, fluxes])

  // In "unread" mode: include unread items + the currently open item so it stays
  // visible while reading. It disappears only when another item is opened.
  const filteredItems = useMemo(() => {
    if (filterMode === "unread") {
      return sortedItems.filter(
        (item) => !readIds.has(getTaggedItemId(item)) || getTaggedItemId(item) === openItemId,
      )
    }
    return sortedItems
  }, [sortedItems, readIds, filterMode, openItemId])

  // Refs for keyboard handler — always current without re-registering the listener
  const filteredItemsRef = useRef(filteredItems)
  const openItemIdRef = useRef(openItemId)
  useLayoutEffect(() => {
    filteredItemsRef.current = filteredItems
    openItemIdRef.current = openItemId
  })

  // Derive selectedIndex from openItemId — stable even when list shrinks
  const selectedIndex = useMemo(() => {
    if (openItemId === null) return null
    const idx = filteredItems.findIndex((i) => getTaggedItemId(i) === openItemId)
    return idx === -1 ? null : idx
  }, [filteredItems, openItemId])

  const handleSelect = useCallback(
    (index: number) => {
      const item = filteredItems[index]
      if (!item) return
      setOpenState({ selectionId, itemId: getTaggedItemId(item) })
    },
    [filteredItems, selectionId],
  )

  // Mark the open item as read after openItemId is committed, so the filter
  // keeps it visible during the same render cycle (readIds updates after).
  useEffect(() => {
    if (openItemId === null) return
    const item = sortedItems.find((i) => getTaggedItemId(i) === openItemId)
    if (item) void markRead(item)
  }, [openItemId, sortedItems, markRead])

  const unreadCount = useMemo(
    () => sortedItems.filter((item) => !readIds.has(getTaggedItemId(item))).length,
    [sortedItems, readIds],
  )

  // Unread counts per repository (for sidebar badges)
  const allConnectorItems = useMemo((): TaggedItem[] => {
    if (!connectors) return []
    return flattenConnectors(connectors)
  }, [connectors])

  const unreadCountByRepoId = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const tagged of allConnectorItems) {
      if (!readIds.has(getTaggedItemId(tagged))) {
        const k = sourceKey(tagged.item._instance_id, tagged.item.repository_id)
        counts[k] = (counts[k] ?? 0) + 1
      }
    }
    return counts
  }, [allConnectorItems, readIds])

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex === null) return
    const el = listContainerRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [selectedIndex])

  // Mark all items in current view as read
  const handleMarkAllRead = useCallback(() => {
    void markAllRead(sortedItems)
  }, [sortedItems, markAllRead])

  // Cleanup read items that are no longer in the feed
  useEffect(() => {
    if (!connectors || !initialized) return
    const allIds = new Set(flattenConnectors(connectors).map(getTaggedItemId))
    void cleanup(allIds)
  }, [connectors, initialized, cleanup])

  // Keyboard navigation — uses refs so the handler never goes stale
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const current = filteredItemsRef.current
      const currentId = openItemIdRef.current
      const currentIdx =
        currentId !== null ? current.findIndex((i) => getTaggedItemId(i) === currentId) : -1

      if (e.key === "ArrowDown") {
        e.preventDefault()
        const nextIdx = currentIdx === -1 ? 0 : Math.min(currentIdx + 1, current.length - 1)
        const next = current[nextIdx]
        if (next) {
          setOpenState({ selectionId, itemId: getTaggedItemId(next) })
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        const nextIdx = currentIdx === -1 ? 0 : Math.max(currentIdx - 1, 0)
        const next = current[nextIdx]
        if (next) {
          setOpenState({ selectionId, itemId: getTaggedItemId(next) })
        }
      } else if (e.key === "Enter" && currentId !== null) {
        const item = current.find((i) => getTaggedItemId(i) === currentId)
        if (item) {
          const url = getItemExternalUrl(item, templates, sourceMap)
          if (url) void openUrl(url)
        }
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [selectionId, templates, sourceMap])

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 h-[52px] shrink-0"
        data-tauri-drag-region
        style={{ borderBottom: "1px solid var(--border-soft)" }}
      >
        <div className="flex items-center gap-2">
          <AuroraWordmark size={14} />
        </div>

        <div className="flex items-center gap-2">
          <UserMenu
            session={session}
            instanceCount={auth.instances.length}
            onLogout={onLogout}
            onOpenProfile={() => setProfileOpen(true)}
            onOpenInstances={() => setInstancesOpen(true)}
          />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <FeedSidebar
          fluxes={fluxes}
          templates={templates}
          userId={session.userId}
          onRefresh={stableRefresh}
          loading={loading}
          unreadCountByRepoId={unreadCountByRepoId}
          width={sidebarWidth}
        />
        <div
          className="w-[4px] shrink-0 cursor-col-resize hover:bg-accent transition-colors"
          style={{ borderRight: "1px solid hsl(var(--border))" }}
          onMouseDown={handleSidebarDrag}
        />

        {/* List panel */}
        <div className="shrink-0 flex flex-col" style={{ width: listWidth }}>
          {/* Filter bar */}
          <div
            className="flex items-center gap-1 px-3 py-2 shrink-0"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <button
              onClick={() => {
                setFilterState({ selectionId, mode: "all" })
              }}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded text-[15px] transition-colors",
                filterMode === "all"
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
              style={filterMode === "all" ? { background: "var(--surface-3)" } : undefined}
            >
              {t.feed.filterAll}
              <span
                className="text-[13px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: "var(--surface-2)", color: "var(--dim)" }}
              >
                {sortedItems.length}
              </span>
            </button>
            <button
              onClick={() => {
                setFilterState({ selectionId, mode: "unread" })
              }}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded text-[15px] transition-colors",
                filterMode === "unread"
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
              style={filterMode === "unread" ? { background: "var(--surface-3)" } : undefined}
            >
              {t.feed.filterUnread}
              {unreadCount > 0 && (
                <span
                  className="text-[13px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background: "var(--teal-dim)", color: "var(--teal)" }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="flex-1" />
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                title={t.feed.markAllRead}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <CheckCheck size={16} />
              </button>
            )}
          </div>

          {instanceErrors.length > 0 && (
            <div
              className="px-3 py-1.5 text-[12px] shrink-0"
              style={{ background: "var(--rose-dim)", color: "var(--rose)" }}
            >
              {t.instances.unreachable} : {instanceErrors.map((e) => e.instanceName).join(", ")}
            </div>
          )}

          <div ref={listContainerRef} className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-[15px] text-muted-foreground italic py-12 text-center">
                {t.feed.loading}
              </p>
            ) : error ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-[15px] text-destructive">{error}</p>
                <button onClick={refresh} className="text-[13px] text-muted-foreground underline">
                  {t.feed.retry}
                </button>
              </div>
            ) : (
              <UnifiedFeedList
                items={filteredItems}
                selectedIndex={selectedIndex}
                onSelect={handleSelect}
                repositories={repositories}
                templates={templates}
                readIds={readIds}
              />
            )}
          </div>
        </div>

        <div
          className="w-[4px] shrink-0 cursor-col-resize hover:bg-accent transition-colors"
          style={{ borderRight: "1px solid hsl(var(--border))" }}
          onMouseDown={handleListDrag}
        />

        {/* Content panel */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <FeedContentViewer
            item={
              openItemId !== null
                ? (filteredItems.find((i) => getTaggedItemId(i) === openItemId) ?? null)
                : null
            }
            repositories={repositories}
            templates={templates}
          />
        </div>
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} session={session} />
      <InstancesModal open={instancesOpen} onClose={() => setInstancesOpen(false)} auth={auth} />
    </div>
  )
}
