import type {
  TaggedItem,
  YoutubeItemContent,
  RssItemContent,
  ScrapItemParams,
  Provider,
} from "@/types"
import { formatDate, openUrl } from "@/lib/utils"
import { useLanguage } from "@/context/LanguageContext"

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === "youtu.be") return u.pathname.slice(1)
    return u.searchParams.get("v")
  } catch {
    return null
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
  documentation: "var(--indigo)",
}

const PROVIDER_DIM: Record<Provider, string> = {
  changelog: "var(--teal-dim)",
  youtube: "var(--rose-dim)",
  rss: "var(--amber-dim)",
  scrap: "var(--green-dim)",
  documentation: "var(--indigo-dim)",
}

interface FeedContentViewerProps {
  item: TaggedItem | null
  repositories: { repository_id: number; url: string }[]
}

export function FeedContentViewer({ item, repositories }: FeedContentViewerProps) {
  const { t } = useLanguage()

  if (!item) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[13px] italic text-muted-foreground">{t.viewer.selectItem}</p>
      </div>
    )
  }

  const repoUrlMap = Object.fromEntries(repositories.map((r) => [r.repository_id, r.url]))
  const color = PROVIDER_COLORS[item.provider]
  const dimColor = PROVIDER_DIM[item.provider]

  if (item.provider === "changelog") {
    return (
      <ChangelogContent
        item={item.item}
        repoUrl={repoUrlMap[item.item.repository_id] ?? ""}
        color={color}
        dimColor={dimColor}
        labels={t.viewer}
      />
    )
  }
  if (item.provider === "youtube") {
    return <YoutubeContent item={item.item} color={color} dimColor={dimColor} labels={t.viewer} />
  }
  if (item.provider === "rss") {
    return <RssContent item={item.item} color={color} dimColor={dimColor} labels={t.viewer} />
  }
  return <ScrapContent item={item.item} color={color} dimColor={dimColor} labels={t.viewer} />
}

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M7 1h4v4M11 1L5 7M3 3H1v8h8V9"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function OpenButton({
  href,
  label,
  color,
  dimColor,
}: {
  href: string
  label: string
  color: string
  dimColor: string
}) {
  return (
    <button
      onClick={() => void openUrl(href)}
      className="mt-6 inline-flex items-center gap-2 text-[12px] font-mono px-3 py-1.5 rounded transition-opacity hover:opacity-80"
      style={{ background: dimColor, color }}
    >
      <ExternalLinkIcon />
      {label}
    </button>
  )
}

type ViewerLabels = {
  noTitle: string
  openOnGithub: string
  watchOnYoutube: string
  readArticle: string
  visitWebsite: string
}

function ChangelogContent({
  item,
  repoUrl,
  color,
  dimColor,
  labels,
}: {
  item: import("@/types").ChangelogItem
  repoUrl: string
  color: string
  dimColor: string
  labels: ViewerLabels
}) {
  const href = repoUrl ? `${repoUrl}/releases/tag/${item.version}` : undefined
  const repoName = repoUrl.replace("https://github.com/", "") || "repository"

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[12px] font-mono text-gray-500">{repoName}</span>
        <span
          className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded"
          style={{ background: dimColor, color }}
        >
          {item.version}
        </span>
        <span className="ml-auto text-[11px] font-mono text-gray-500">
          {formatDate(item.datetime ?? item.executed_at)}
        </span>
      </div>

      {item.content && (
        <div className="text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
          {item.content
            .replace(/#{1,6}\s/g, "")
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/`([^`]+)`/g, "$1")}
        </div>
      )}

      {href && (
        <OpenButton href={href} label={labels.openOnGithub} color={color} dimColor={dimColor} />
      )}
    </div>
  )
}

function YoutubeContent({
  item,
  color,
  dimColor,
  labels,
}: {
  item: import("@/types").YoutubeItem
  color: string
  dimColor: string
  labels: ViewerLabels
}) {
  let parsed: YoutubeItemContent | null = null
  try {
    parsed = JSON.parse(item.content) as YoutubeItemContent
  } catch {
    /* ignore */
  }

  const videoUrl = parsed?.link ?? parsed?.url
  const channelName = parsed?.url ? extractChannelName(parsed.url) : null
  const videoId = parsed?.link ? extractYoutubeId(parsed.link) : null
  const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-[16px] font-semibold text-gray-900 dark:text-gray-100 leading-snug mb-2">
        {parsed?.title ?? labels.noTitle}
      </h2>

      <div className="flex items-center gap-3 mb-5">
        {channelName && (
          <span className="text-[12px] font-mono" style={{ color }}>
            {channelName}
          </span>
        )}
        <span className="text-[11px] font-mono text-gray-500">
          {formatDate(item.datetime ?? item.executed_at)}
        </span>
      </div>

      <div className="mb-5 rounded overflow-hidden" style={{ aspectRatio: "16/9", maxWidth: 640 }}>
        {embedUrl ? (
          <iframe
            src={embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={parsed?.title ?? ""}
          />
        ) : parsed?.thumbnail ? (
          <img
            src={parsed.thumbnail}
            alt={parsed?.title ?? ""}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : null}
      </div>

      {videoUrl && (
        <OpenButton
          href={videoUrl}
          label={labels.watchOnYoutube}
          color={color}
          dimColor={dimColor}
        />
      )}
    </div>
  )
}

const getRssStyles = (color: string) => `
  .rss-body { font-size: 13px; line-height: 1.65; color: rgb(156 163 175); }
  .rss-body p { margin: 0 0 0.9em; }
  .rss-body a { color: ${color}; text-decoration: underline; }
  .rss-body h1, .rss-body h2, .rss-body h3 { color: rgb(243 244 246); margin: 1.2em 0 0.4em; font-weight: 600; font-size: 14px; }
  .rss-body ul, .rss-body ol { padding-left: 1.5em; margin: 0 0 0.9em; }
  .rss-body li { line-height: 1.65; }
  .rss-body img { max-width: 100%; height: auto; border-radius: 4px; margin: 0.5em 0; }
  .rss-body code { background: var(--surface-2); padding: 1px 5px; border-radius: 3px; font-size: 12px; font-family: monospace; }
  .rss-body pre { background: var(--surface-2); padding: 12px; border-radius: 6px; overflow-x: auto; margin: 0 0 0.9em; }
  .rss-body blockquote { border-left: 2px solid ${color}; padding-left: 12px; margin: 0 0 0.9em; color: rgb(107 114 128); }
`

function RssContent({
  item,
  color,
  dimColor,
  labels,
}: {
  item: import("@/types").RssItem
  color: string
  dimColor: string
  labels: ViewerLabels
}) {
  let parsed: RssItemContent | null = null
  try {
    parsed = JSON.parse(item.content) as RssItemContent
  } catch {
    /* ignore */
  }

  const source = parsed?.link ? extractHostname(parsed.link) : null

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-[16px] font-semibold text-gray-900 dark:text-gray-100 leading-snug mb-2">
        {parsed?.title ?? labels.noTitle}
      </h2>

      <div className="flex items-center gap-3 mb-6">
        {source && (
          <span className="text-[12px] font-mono" style={{ color }}>
            {source}
          </span>
        )}
        <span className="text-[11px] font-mono text-gray-500">
          {formatDate(item.datetime ?? item.executed_at)}
        </span>
      </div>

      {parsed?.summary && (
        <>
          <style>{getRssStyles(color)}</style>
          <div className="rss-body" dangerouslySetInnerHTML={{ __html: parsed.summary }} />
        </>
      )}

      {parsed?.link && (
        <OpenButton
          href={parsed.link}
          label={labels.readArticle}
          color={color}
          dimColor={dimColor}
        />
      )}
    </div>
  )
}

function ScrapContent({
  item,
  color,
  dimColor,
  labels,
}: {
  item: import("@/types").ScrapItem
  color: string
  dimColor: string
  labels: ViewerLabels
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

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-5">
        {params?.url && (
          <span className="text-[12px] font-mono truncate" style={{ color }}>
            {params.url}
          </span>
        )}
        <span className="text-[11px] font-mono shrink-0 text-gray-500">
          {formatDate(item.executed_at)}
        </span>
      </div>

      {item.content && (
        <p className="text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
          {item.content}
        </p>
      )}

      {params?.url && (
        <OpenButton
          href={params.url}
          label={labels.visitWebsite}
          color={color}
          dimColor={dimColor}
        />
      )}
    </div>
  )
}
