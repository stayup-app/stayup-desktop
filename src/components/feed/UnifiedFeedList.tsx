import type {
  TaggedItem,
  YoutubeItemContent,
  RssItemContent,
  ScrapItemParams,
  Provider,
} from "@/types"
import { formatDate } from "@/lib/utils"
import { useLanguage } from "@/context/LanguageContext"

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function extractChannelName(url: string): string {
  try {
    const { pathname } = new URL(url)
    const atMatch = pathname.match(/^\/@(.+)/)
    if (atMatch) return `@${atMatch[1]}`
    const segments = pathname.split("/").filter(Boolean)
    return segments[segments.length - 1] ?? url
  } catch {
    return url
  }
}

const PROVIDER_COLORS: Record<Provider, string> = {
  changelog: "var(--teal)",
  youtube: "var(--rose)",
  rss: "var(--amber)",
  scrap: "var(--green)",
}

const PROVIDER_DIM: Record<Provider, string> = {
  changelog: "var(--teal-dim)",
  youtube: "var(--rose-dim)",
  rss: "var(--amber-dim)",
  scrap: "var(--green-dim)",
}

const PROVIDER_ICONS: Record<Provider, React.ReactNode> = {
  changelog: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1L9.5 4H11.5L7 1ZM7 1L4.5 4H2.5L7 1Z" fill="currentColor" opacity="0.8" />
      <rect x="2" y="4" width="10" height="1" rx="0.5" fill="currentColor" />
      <rect x="3" y="6.5" width="8" height="1" rx="0.5" fill="currentColor" opacity="0.5" />
      <rect x="3" y="8.5" width="6" height="1" rx="0.5" fill="currentColor" opacity="0.5" />
    </svg>
  ),
  youtube: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="12" height="8" rx="2" fill="currentColor" />
      <path d="M5.5 5.5L9 7L5.5 8.5V5.5Z" fill="white" />
    </svg>
  ),
  rss: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
  scrap: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <ellipse cx="7" cy="7" rx="2" ry="5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
}

interface UnifiedFeedListProps {
  items: TaggedItem[]
  selectedIndex: number | null
  onSelect: (index: number) => void
  repositories: { repository_id: number; url: string }[]
  readIds?: Set<string>
}

export function UnifiedFeedList({
  items,
  selectedIndex,
  onSelect,
  repositories,
  readIds,
}: UnifiedFeedListProps) {
  const { t } = useLanguage()

  if (items.length === 0) {
    return (
      <p className="text-[15px] text-muted-foreground italic py-12 text-center">
        {t.feed.noContent}
      </p>
    )
  }

  const repoUrlMap = Object.fromEntries(repositories.map((r) => [r.repository_id, r.url]))

  return (
    <div>
      {items.map((tagged, i) => {
        const color = PROVIDER_COLORS[tagged.provider]
        const icon = PROVIDER_ICONS[tagged.provider]
        const isSelected = selectedIndex === i
        const isRead = readIds?.has(`${tagged.provider}:${tagged.item.id}`) ?? false

        return (
          <div
            key={i}
            data-index={i}
            className="flex gap-3 px-3 py-2.5 cursor-pointer transition-colors"
            style={{
              background: isSelected ? "var(--surface-2)" : undefined,
              borderLeft: isSelected ? `2px solid ${color}` : "2px solid transparent",
              borderBottom: "1px solid var(--border-subtle)",
              opacity: isRead && !isSelected ? 0.45 : 1,
            }}
            onClick={() => onSelect(i)}
          >
            <div className="mt-0.5 shrink-0" style={{ color }}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              {tagged.provider === "changelog" && (
                <ChangelogEntry
                  item={tagged.item}
                  repoUrl={repoUrlMap[tagged.item.repository_id] ?? ""}
                  color={color}
                  dimColor={PROVIDER_DIM[tagged.provider]}
                  repositoryLabel={t.viewer.repository}
                />
              )}
              {tagged.provider === "youtube" && (
                <YoutubeEntry item={tagged.item} color={color} noTitle={t.viewer.noTitle} />
              )}
              {tagged.provider === "rss" && (
                <RssEntry item={tagged.item} color={color} noTitle={t.viewer.noTitle} />
              )}
              {tagged.provider === "scrap" && (
                <ScrapEntry item={tagged.item} color={color} scrapLabel={t.feed.providers.scrap} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ChangelogEntry({
  item,
  repoUrl,
  color,
  dimColor,
  repositoryLabel,
}: {
  item: import("@/types").ChangelogItem
  repoUrl: string
  color: string
  dimColor: string
  repositoryLabel: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[14px] font-mono text-muted-foreground truncate">
            {repoUrl?.replace("https://github.com/", "") ?? repositoryLabel}
          </span>
          <span
            className="text-[13px] font-mono font-semibold px-1.5 py-0.5 rounded shrink-0"
            style={{ background: dimColor, color }}
          >
            {item.version}
          </span>
        </div>
        <span className="text-[13px] font-mono shrink-0 text-gray-500">
          {formatDate(item.datetime ?? item.executed_at)}
        </span>
      </div>
      {item.content && (
        <p className="text-[14px] text-muted-foreground line-clamp-1 leading-relaxed">
          {item.content
            .replace(/#{1,6}\s/g, "")
            .replace(/\r\n/g, " ")
            .slice(0, 120)}
        </p>
      )}
    </div>
  )
}

function YoutubeEntry({
  item,
  color,
  noTitle,
}: {
  item: import("@/types").YoutubeItem
  color: string
  noTitle: string
}) {
  let parsed: YoutubeItemContent | null = null
  try {
    parsed = JSON.parse(item.content) as YoutubeItemContent
  } catch {
    /* ignore */
  }

  return (
    <div className="flex gap-3">
      <div
        className="w-20 h-[45px] rounded shrink-0 flex items-center justify-center overflow-hidden"
        style={{ background: "var(--surface-2)" }}
      >
        {parsed?.thumbnail ? (
          <img
            src={parsed.thumbnail}
            alt={parsed?.title ?? ""}
            width={80}
            height={45}
            loading="lazy"
            className="object-cover w-full h-full"
          />
        ) : (
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ color }}>
            <circle
              cx="10"
              cy="10"
              r="9"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
              opacity="0.4"
            />
            <path d="M8 7L14 10L8 13V7Z" fill="currentColor" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium line-clamp-2 leading-snug text-foreground mb-0.5">
          {parsed?.title ?? noTitle}
        </p>
        <div className="flex items-center gap-2">
          {parsed?.url && (
            <span className="text-[13px] font-mono truncate" style={{ color }}>
              {extractChannelName(parsed.url)}
            </span>
          )}
          <span className="text-[13px] font-mono shrink-0 text-gray-500">
            {formatDate(item.datetime ?? item.executed_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

function RssEntry({
  item,
  color,
  noTitle,
}: {
  item: import("@/types").RssItem
  color: string
  noTitle: string
}) {
  let parsed: RssItemContent | null = null
  try {
    parsed = JSON.parse(item.content) as RssItemContent
  } catch {
    /* ignore */
  }

  const source = parsed?.link ? extractHostname(parsed.link) : null

  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <span className="text-[15px] font-medium line-clamp-1 text-foreground">
          {parsed?.title ?? noTitle}
        </span>
        <span className="text-[13px] font-mono shrink-0 text-gray-500">
          {formatDate(item.datetime ?? item.executed_at)}
        </span>
      </div>
      {source && (
        <p className="text-[13px] font-mono" style={{ color }}>
          {source}
        </p>
      )}
    </div>
  )
}

function ScrapEntry({
  item,
  color,
  scrapLabel,
}: {
  item: import("@/types").ScrapItem
  color: string
  scrapLabel: string
}) {
  const params: ScrapItemParams | null =
    typeof item.params === "string"
      ? (() => {
          try {
            return JSON.parse(item.params) as ScrapItemParams
          } catch {
            return null
          }
        })()
      : (item.params as ScrapItemParams | null)

  const source = params?.url ? extractHostname(params.url) : null

  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <span className="text-[15px] font-medium line-clamp-1 text-foreground">
          {item.content?.slice(0, 80) ?? params?.url ?? scrapLabel}
        </span>
        <span className="text-[13px] font-mono shrink-0 text-gray-500">
          {formatDate(item.executed_at)}
        </span>
      </div>
      {source && (
        <p className="text-[13px] font-mono" style={{ color }}>
          {source}
        </p>
      )}
    </div>
  )
}
