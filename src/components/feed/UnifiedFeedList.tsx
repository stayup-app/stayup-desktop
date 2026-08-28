import type { TaggedItem, FeedRepository } from "@/types"
import type { ProviderMeta } from "@/lib/providerTemplate"
import { formatDate } from "@/lib/utils"
import { useLanguage } from "@/context/LanguageContext"
import { TemplatedEntry } from "./TemplatedEntry"
import { providerIcon, providerAccent, providerLabel } from "./providerIcons"

interface UnifiedFeedListProps {
  items: TaggedItem[]
  selectedIndex: number | null
  onSelect: (index: number) => void
  repositories: FeedRepository[]
  templates: Record<string, ProviderMeta>
  readIds?: Set<string>
}

export function UnifiedFeedList({
  items,
  selectedIndex,
  onSelect,
  repositories,
  templates,
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

  const sourceMap = Object.fromEntries(
    repositories.map((r) => [
      r.repository_id,
      { url: r.url, config: r.config ?? {}, type: r.provider ?? "" },
    ]),
  )

  return (
    <div>
      {items.map((tagged, i) => {
        const meta = templates[tagged.provider]
        const color = providerAccent(meta)
        const isSelected = selectedIndex === i
        const isRead = readIds?.has(`${tagged.provider}:${tagged.item.id}`) ?? false
        const source = sourceMap[tagged.item.repository_id as number]

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
              {providerIcon(meta?.template?.display)}
            </div>
            <div className="flex-1 min-w-0">
              {meta?.template ? (
                <TemplatedEntry
                  template={meta.template}
                  item={tagged.item as Record<string, unknown>}
                  source={source}
                  color={color}
                />
              ) : (
                <GenericEntry
                  item={tagged.item}
                  color={color}
                  providerLabel={providerLabel(meta, tagged.provider)}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GenericEntry({
  item,
  color,
  providerLabel,
}: {
  item: TaggedItem["item"]
  color: string
  providerLabel: string
}) {
  const content = typeof item.content === "string" ? item.content : ""
  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <span className="text-[15px] font-medium line-clamp-1 text-foreground">
          {content.slice(0, 80) || providerLabel}
        </span>
        <span className="text-[13px] font-mono shrink-0 text-dim">
          {formatDate(item.datetime ?? item.executed_at)}
        </span>
      </div>
      <p className="text-[13px] font-mono" style={{ color }}>
        {providerLabel}
      </p>
    </div>
  )
}
