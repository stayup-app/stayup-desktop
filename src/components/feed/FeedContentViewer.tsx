import { useState } from "react"
import type {
  TaggedItem,
  YoutubeItemContent,
  RssItemContent,
  ScrapItemParams,
  GenericItem,
  Provider,
} from "@/types"
import { isKnownTaggedItem } from "@/types"
import { formatDate, openUrl, providerDisplayName } from "@/lib/utils"
import { useLanguage } from "@/context/LanguageContext"

const LS_FONT_KEY = "STAYUP_FONT_SIZE_OFFSET"
const MIN_OFFSET = -4
const MAX_OFFSET = 10

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
}

const PROVIDER_DIM: Record<Provider, string> = {
  changelog: "var(--teal-dim)",
  youtube: "var(--rose-dim)",
  rss: "var(--amber-dim)",
  scrap: "var(--green-dim)",
}

// Couleurs de repli pour tout provider sans rendu dédié dans l'app.
const GENERIC_COLOR = "var(--muted-foreground)"
const GENERIC_DIM = "var(--surface-2)"

interface FeedContentViewerProps {
  item: TaggedItem | null
  repositories: { repository_id: number; url: string }[]
}

export function FeedContentViewer({ item, repositories }: FeedContentViewerProps) {
  const { t } = useLanguage()
  const [fontSizeOffset, setFontSizeOffset] = useState(() => {
    try {
      const stored = localStorage.getItem(LS_FONT_KEY)
      return stored ? parseInt(stored, 10) || 0 : 0
    } catch {
      return 0
    }
  })

  function changeFontSize(delta: number) {
    setFontSizeOffset((prev) => {
      const next = Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, prev + delta))
      try {
        localStorage.setItem(LS_FONT_KEY, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const fontControls = (
    <div
      className="sticky top-0 z-10 flex justify-end items-center gap-1 px-4 py-2 shrink-0"
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg)",
      }}
    >
      <span className="text-[13px] font-mono text-muted-foreground mr-1">A</span>
      <button
        onClick={() => changeFontSize(-1)}
        disabled={fontSizeOffset <= MIN_OFFSET}
        className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
        style={{ border: "1px solid hsl(var(--border))" }}
        aria-label="Réduire la police"
      >
        <span className="text-[16px] leading-none select-none">−</span>
      </button>
      <button
        onClick={() => changeFontSize(1)}
        disabled={fontSizeOffset >= MAX_OFFSET}
        className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
        style={{ border: "1px solid hsl(var(--border))" }}
        aria-label="Agrandir la police"
      >
        <span className="text-[16px] leading-none select-none">+</span>
      </button>
    </div>
  )

  if (!item) {
    return (
      <div className="flex flex-col h-full">
        {fontControls}
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center max-w-[280px]">
            <p className="font-serif text-[20px] leading-[1.2] text-foreground mb-1.5">
              {t.viewer.selectItem}
            </p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {t.viewer.selectItemHint}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const repoUrlMap = Object.fromEntries(repositories.map((r) => [r.repository_id, r.url]))
  const color = PROVIDER_COLORS[item.provider] ?? GENERIC_COLOR
  const dimColor = PROVIDER_DIM[item.provider] ?? GENERIC_DIM

  return (
    <>
      {fontControls}
      {isKnownTaggedItem(item) ? (
        <>
          {item.provider === "changelog" && (
            <ChangelogContent
              item={item.item}
              repoUrl={repoUrlMap[item.item.repository_id] ?? ""}
              color={color}
              dimColor={dimColor}
              labels={t.viewer}
              fontSizeOffset={fontSizeOffset}
            />
          )}
          {item.provider === "youtube" && (
            <YoutubeContent
              item={item.item}
              color={color}
              dimColor={dimColor}
              labels={t.viewer}
              fontSizeOffset={fontSizeOffset}
            />
          )}
          {item.provider === "rss" && (
            <RssContent
              item={item.item}
              color={color}
              dimColor={dimColor}
              labels={t.viewer}
              fontSizeOffset={fontSizeOffset}
            />
          )}
          {item.provider === "scrap" && (
            <ScrapContent
              item={item.item}
              color={color}
              dimColor={dimColor}
              labels={t.viewer}
              fontSizeOffset={fontSizeOffset}
            />
          )}
        </>
      ) : (
        <GenericContent
          item={item.item}
          color={color}
          dimColor={dimColor}
          providerLabel={providerDisplayName(item.provider)}
          fontSizeOffset={fontSizeOffset}
        />
      )}
    </>
  )
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
      className="mt-6 inline-flex items-center gap-2 text-[14px] font-mono px-3 py-1.5 rounded transition-opacity hover:opacity-80"
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
  fontSizeOffset,
}: {
  item: import("@/types").ChangelogItem
  repoUrl: string
  color: string
  dimColor: string
  labels: ViewerLabels
  fontSizeOffset: number
}) {
  const href = repoUrl ? `${repoUrl}/releases/tag/${item.version}` : undefined
  const repoName = repoUrl.replace("https://github.com/", "") || "repository"

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-5">
        <span className="text-[14px] font-mono text-dim">{repoName}</span>
        <span
          className="text-[13px] font-mono font-semibold px-1.5 py-0.5 rounded"
          style={{ background: dimColor, color }}
        >
          {item.version}
        </span>
        <span className="ml-auto text-[13px] font-mono text-dim">
          {formatDate(item.datetime ?? item.executed_at)}
        </span>
      </div>

      {item.content && (
        <div
          className="text-muted-foreground leading-relaxed whitespace-pre-wrap"
          style={{ fontSize: `${15 + fontSizeOffset}px` }}
        >
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
  fontSizeOffset,
}: {
  item: import("@/types").YoutubeItem
  color: string
  dimColor: string
  labels: ViewerLabels
  fontSizeOffset: number
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
      <h2
        className="font-serif font-normal tracking-editorial text-foreground leading-[1.15] mb-2"
        style={{ fontSize: `${26 + fontSizeOffset}px` }}
      >
        {parsed?.title ?? labels.noTitle}
      </h2>

      <div className="flex items-center gap-3 mb-5">
        {channelName && (
          <span className="text-[14px] font-mono" style={{ color }}>
            {channelName}
          </span>
        )}
        <span className="text-[13px] font-mono text-dim">
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

const getRssStyles = (color: string, fontSize: number) => `
  .rss-body { font-size: ${fontSize}px; line-height: 1.65; color: var(--fg-soft); }
  .rss-body p { margin: 0 0 0.9em; }
  .rss-body a { color: ${color}; text-decoration: underline; }
  .rss-body h1, .rss-body h2, .rss-body h3 { color: var(--fg); margin: 1.2em 0 0.4em; font-weight: 600; font-size: ${fontSize + 1}px; }
  .rss-body ul, .rss-body ol { padding-left: 1.5em; margin: 0 0 0.9em; }
  .rss-body li { line-height: 1.65; }
  .rss-body img { max-width: 100%; height: auto; border-radius: 4px; margin: 0.5em 0; }
  .rss-body code { background: var(--surface); color: var(--peach); padding: 1px 6px; border-radius: 4px; font-size: ${fontSize - 1}px; font-family: 'JetBrains Mono', monospace; }
  .rss-body pre { background: var(--bg-soft); border: 1px solid var(--border-soft); padding: 12px; border-radius: 10px; overflow-x: auto; margin: 0 0 0.9em; }
  .rss-body blockquote { border-left: 3px solid var(--peach); background: var(--peach-dim); padding: 10px 16px; margin: 0 0 0.9em; border-radius: 0 8px 8px 0; font-family: 'Instrument Serif', serif; font-style: italic; font-size: ${fontSize + 3}px; color: var(--fg); }
`

function RssContent({
  item,
  color,
  dimColor,
  labels,
  fontSizeOffset,
}: {
  item: import("@/types").RssItem
  color: string
  dimColor: string
  labels: ViewerLabels
  fontSizeOffset: number
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
      <h2
        className="font-serif font-normal tracking-editorial text-foreground leading-[1.1] mb-2"
        style={{ fontSize: `${30 + fontSizeOffset}px` }}
      >
        {parsed?.title ?? labels.noTitle}
      </h2>

      <div className="flex items-center gap-3 mb-6">
        {source && (
          <span className="text-[14px] font-mono" style={{ color }}>
            {source}
          </span>
        )}
        <span className="text-[13px] font-mono text-dim">
          {formatDate(item.datetime ?? item.executed_at)}
        </span>
      </div>

      {parsed?.summary && (
        <>
          <style>{getRssStyles(color, 15 + fontSizeOffset)}</style>
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
  fontSizeOffset,
}: {
  item: import("@/types").ScrapItem
  color: string
  dimColor: string
  labels: ViewerLabels
  fontSizeOffset: number
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
          <span className="text-[14px] font-mono truncate" style={{ color }}>
            {params.url}
          </span>
        )}
        <span className="text-[13px] font-mono shrink-0 text-dim">
          {formatDate(item.executed_at)}
        </span>
      </div>

      {item.content && (
        <p
          className="text-muted-foreground leading-relaxed whitespace-pre-wrap"
          style={{ fontSize: `${15 + fontSizeOffset}px` }}
        >
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

function GenericContent({
  item,
  color,
  dimColor,
  providerLabel,
  fontSizeOffset,
}: {
  item: GenericItem
  color: string
  dimColor: string
  providerLabel: string
  fontSizeOffset: number
}) {
  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-5">
        <span
          className="text-[13px] font-mono font-semibold px-1.5 py-0.5 rounded"
          style={{ background: dimColor, color }}
        >
          {providerLabel}
        </span>
        {item.version && <span className="text-[14px] font-mono text-dim">{item.version}</span>}
        <span className="ml-auto text-[13px] font-mono text-dim">
          {formatDate(item.datetime ?? item.executed_at)}
        </span>
      </div>

      {item.content && (
        <div
          className="text-muted-foreground leading-relaxed whitespace-pre-wrap"
          style={{ fontSize: `${15 + fontSizeOffset}px` }}
        >
          {item.content}
        </div>
      )}
    </div>
  )
}
