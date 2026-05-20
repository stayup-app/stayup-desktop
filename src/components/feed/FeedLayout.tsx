import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useNavigationStore } from "@/store/navigation"
import { useReadItemsStore, getTaggedItemId } from "@/store/readItems"
import { useFeed } from "@/hooks/useFeed"
import { useMenu } from "@/hooks/useMenu"
import { useLanguage } from "@/context/LanguageContext"
import { useTheme } from "@/context/ThemeContext"
import { FeedSidebar } from "./FeedSidebar"
import { UnifiedFeedList } from "./UnifiedFeedList"
import { FeedContentViewer } from "./FeedContentViewer"
import { DocList } from "@/components/documentation/DocList"
import { DocViewer } from "@/components/documentation/DocViewer"
import { HistoryList } from "@/components/documentation/HistoryList"
import { DiffViewer } from "@/components/documentation/DiffViewer"
import { UserMenu } from "@/components/layout/UserMenu"
import { cn } from "@/lib/utils"
import { openUrl } from "@/lib/utils"
import type { AppSession } from "@/lib/session"
import type { TaggedItem, Provider } from "@/types"

interface FeedLayoutProps {
  session: AppSession
  onLogout: () => void
  onCheckUpdates: () => void
}

type FilterMode = "all" | "unread"

function getItemDate(tagged: TaggedItem): string {
  const item = tagged.item
  if ("datetime" in item && item.datetime) return item.datetime
  return item.executed_at
}

function getItemExternalUrl(tagged: TaggedItem, repoUrlMap: Record<number, string>): string | null {
  if (tagged.provider === "changelog") {
    const repoUrl = repoUrlMap[tagged.item.repository_id]
    return repoUrl ? `${repoUrl}/releases/tag/${tagged.item.version}` : null
  }
  if (tagged.provider === "youtube") {
    try {
      const p = JSON.parse(tagged.item.content) as { link?: string; url?: string }
      return p.link ?? p.url ?? null
    } catch {
      return null
    }
  }
  if (tagged.provider === "rss") {
    try {
      const p = JSON.parse(tagged.item.content) as { link?: string }
      return p.link ?? null
    } catch {
      return null
    }
  }
  if (tagged.provider === "scrap") {
    const raw = tagged.item.params
    const params =
      typeof raw === "string"
        ? (() => {
            try {
              return JSON.parse(raw)
            } catch {
              return null
            }
          })()
        : raw
    return (params as { url?: string } | null)?.url ?? null
  }
  return null
}

export function FeedLayout({ session, onLogout, onCheckUpdates }: FeedLayoutProps) {
  const { selection } = useNavigationStore()
  const { readIds, initialized, init, markRead, cleanup } = useReadItemsStore()
  const { fluxes, connectors, loading, error, refresh } = useFeed(session.userId)
  const { lang, t, setLang } = useLanguage()
  const { theme, setTheme } = useTheme()
  const listContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void init()
  }, [init])

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
    () => fluxes.map((f) => ({ repository_id: f.repository_id, url: f.url })),
    [fluxes],
  )

  const repoUrlMap = useMemo(
    () => Object.fromEntries(fluxes.map((f) => [f.repository_id, f.url])),
    [fluxes],
  )

  const isFeedView =
    selection.type === "all" || selection.type === "category" || selection.type === "flux"

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

  const [selectedState, setSelectedState] = useState<{ id: string; index: number | null }>({
    id: "",
    index: null,
  })
  const selectedIndex = selectedState.id === selectionId ? selectedState.index : null

  const handleSelect = useCallback(
    (index: number) => setSelectedState({ id: selectionId, index }),
    [selectionId],
  )

  const sortedItems = useMemo((): TaggedItem[] => {
    if (!connectors || !isFeedView) return []

    let raw: TaggedItem[] = []

    if (selection.type === "all") {
      raw = [
        ...(connectors.changelog ?? []).map((item) => ({ provider: "changelog" as const, item })),
        ...(connectors.youtube ?? []).map((item) => ({ provider: "youtube" as const, item })),
        ...(connectors.rss ?? []).map((item) => ({ provider: "rss" as const, item })),
        ...(connectors.scrap ?? []).map((item) => ({ provider: "scrap" as const, item })),
      ]
    } else if (selection.type === "category") {
      const { provider } = selection
      const items =
        provider === "changelog"
          ? (connectors.changelog ?? [])
          : provider === "youtube"
            ? (connectors.youtube ?? [])
            : provider === "rss"
              ? (connectors.rss ?? [])
              : (connectors.scrap ?? [])
      raw = items.map((item) => ({ provider: provider as Provider, item }) as TaggedItem)
    } else if (selection.type === "flux") {
      const { fluxId, provider } = selection
      const flux = fluxes.find((f) => f.id === fluxId)
      const repoId = flux?.repository_id
      const allItems =
        provider === "changelog"
          ? (connectors.changelog ?? [])
          : provider === "youtube"
            ? (connectors.youtube ?? [])
            : provider === "rss"
              ? (connectors.rss ?? [])
              : (connectors.scrap ?? [])
      const filtered = repoId ? allItems.filter((i) => i.repository_id === repoId) : allItems
      raw = filtered.map((item) => ({ provider: provider as Provider, item }) as TaggedItem)
    }

    return raw.sort(
      (a, b) => new Date(getItemDate(b)).getTime() - new Date(getItemDate(a)).getTime(),
    )
  }, [connectors, selection, fluxes, isFeedView])

  const filteredItems = useMemo(() => {
    if (filterMode === "unread") {
      return sortedItems.filter((item) => !readIds.has(getTaggedItemId(item)))
    }
    return sortedItems
  }, [sortedItems, readIds, filterMode])

  const unreadCount = useMemo(
    () => sortedItems.filter((item) => !readIds.has(getTaggedItemId(item))).length,
    [sortedItems, readIds],
  )

  // Unread counts per repository (for sidebar badges)
  const allConnectorItems = useMemo((): TaggedItem[] => {
    if (!connectors) return []
    return [
      ...(connectors.changelog ?? []).map((item) => ({ provider: "changelog" as const, item })),
      ...(connectors.youtube ?? []).map((item) => ({ provider: "youtube" as const, item })),
      ...(connectors.rss ?? []).map((item) => ({ provider: "rss" as const, item })),
      ...(connectors.scrap ?? []).map((item) => ({ provider: "scrap" as const, item })),
    ]
  }, [connectors])

  const unreadCountByRepoId = useMemo(() => {
    const counts: Record<number, number> = {}
    for (const tagged of allConnectorItems) {
      if (!readIds.has(getTaggedItemId(tagged))) {
        const repoId = tagged.item.repository_id
        counts[repoId] = (counts[repoId] ?? 0) + 1
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

  // Mark selected item as read
  useEffect(() => {
    if (selectedIndex === null) return
    const item = filteredItems[selectedIndex]
    if (item) void markRead(item)
  }, [selectedIndex, filteredItems, markRead])

  // Mark all items in current view as read
  const handleMarkAllRead = useCallback(() => {
    for (const item of sortedItems) {
      void markRead(item)
    }
  }, [sortedItems, markRead])

  // Cleanup read items that are no longer in the feed
  useEffect(() => {
    if (!connectors || !initialized) return
    const allIds = new Set<string>([
      ...(connectors.changelog ?? []).map((item) =>
        getTaggedItemId({ provider: "changelog", item }),
      ),
      ...(connectors.youtube ?? []).map((item) => getTaggedItemId({ provider: "youtube", item })),
      ...(connectors.rss ?? []).map((item) => getTaggedItemId({ provider: "rss", item })),
      ...(connectors.scrap ?? []).map((item) => getTaggedItemId({ provider: "scrap", item })),
    ])
    void cleanup(allIds)
  }, [connectors, initialized, cleanup])

  // Keyboard navigation
  useEffect(() => {
    if (!isFeedView) return

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (!filteredItems.length) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedState((prev) => {
          const idx = prev.id === selectionId ? prev.index : null
          return {
            id: selectionId,
            index: idx === null ? 0 : Math.min(idx + 1, filteredItems.length - 1),
          }
        })
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedState((prev) => {
          const idx = prev.id === selectionId ? prev.index : null
          return {
            id: selectionId,
            index: idx === null ? 0 : Math.max(idx - 1, 0),
          }
        })
      } else if (e.key === "Enter" && selectedIndex !== null) {
        const url = getItemExternalUrl(filteredItems[selectedIndex], repoUrlMap)
        if (url) void openUrl(url)
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isFeedView, filteredItems, selectionId, repoUrlMap, selectedIndex])

  const initial = session.userId?.charAt(0)?.toUpperCase() ?? "?"

  return (
    <div
      className="flex flex-col flex-1 overflow-hidden"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 h-[52px] shrink-0"
        style={{ borderBottom: "1px solid hsl(var(--border))" }}
      >
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 26 26" fill="none">
            <rect width="26" height="26" rx="6" fill="var(--teal)" />
            <path d="M13 6L19.5 15H15V20H11V15H6.5L13 6Z" fill="#09090b" />
          </svg>
          <span className="font-semibold text-[16px]" style={{ letterSpacing: "-0.02em" }}>
            StayUp
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[14px] font-semibold"
            style={{
              background: "linear-gradient(135deg, var(--teal), oklch(0.65 0.22 280))",
              color: "#fafafa",
            }}
          >
            {initial}
          </div>
          <UserMenu session={session} onLogout={onLogout} />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <FeedSidebar
          fluxes={fluxes}
          userId={session.userId}
          onRefresh={stableRefresh}
          unreadCountByRepoId={unreadCountByRepoId}
        />

        {isFeedView ? (
          <>
            {/* List panel */}
            <div
              className="w-[380px] shrink-0 flex flex-col"
              style={{ borderRight: "1px solid hsl(var(--border))" }}
            >
              {/* Filter bar */}
              <div
                className="flex items-center gap-1 px-3 py-2 shrink-0"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
              >
                <button
                  onClick={() => {
                    setFilterState({ selectionId, mode: "all" })
                    setSelectedState({ id: "", index: null })
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
                    setSelectedState({ id: "", index: null })
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
                    className="text-[13px] font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-accent"
                  >
                    {t.feed.markAllRead}
                  </button>
                )}
              </div>

              <div ref={listContainerRef} className="flex-1 overflow-y-auto">
                {loading ? (
                  <p className="text-[15px] text-muted-foreground italic py-12 text-center">
                    {t.feed.loading}
                  </p>
                ) : error ? (
                  <div className="py-12 text-center space-y-2">
                    <p className="text-[15px] text-destructive">{error}</p>
                    <button
                      onClick={refresh}
                      className="text-[13px] text-muted-foreground underline"
                    >
                      {t.feed.retry}
                    </button>
                  </div>
                ) : (
                  <UnifiedFeedList
                    items={filteredItems}
                    selectedIndex={selectedIndex}
                    onSelect={handleSelect}
                    repositories={repositories}
                    readIds={readIds}
                  />
                )}
              </div>
            </div>

            {/* Content panel */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              <FeedContentViewer
                item={selectedIndex !== null ? filteredItems[selectedIndex] : null}
                repositories={repositories}
              />
            </div>
          </>
        ) : (
          <main className="flex-1 overflow-y-auto px-5 py-4">
            {selection.type === "documentation" && <DocList />}
            {selection.type === "doc" && <DocViewer docId={selection.docId} />}
            {selection.type === "doc-history" && <HistoryList docId={selection.docId} />}
            {selection.type === "doc-diff" && (
              <DiffViewer docId={selection.docId} versionId={selection.versionId} />
            )}
          </main>
        )}
      </div>
    </div>
  )
}
