import { useState } from "react"
import type { TaggedItem, FeedRepository } from "@/types"
import type { ProviderMeta } from "@/lib/providerTemplate"
import { formatDate } from "@/lib/utils"
import { useLanguage } from "@/context/LanguageContext"
import { TemplatedDetail } from "./TemplatedDetail"
import { providerAccent, providerLabel } from "./providerIcons"

const LS_FONT_KEY = "STAYUP_FONT_SIZE_OFFSET"
const MIN_OFFSET = -4
const MAX_OFFSET = 10
const GENERIC_DIM = "var(--surface-2)"

interface FeedContentViewerProps {
  item: TaggedItem | null
  repositories: FeedRepository[]
  templates: Record<string, ProviderMeta>
}

export function FeedContentViewer({ item, repositories, templates }: FeedContentViewerProps) {
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

  const repo = repositories.find((r) => r.repository_id === item.item.repository_id)
  const source = repo
    ? { url: repo.url, config: repo.config ?? {}, type: repo.provider ?? "" }
    : undefined
  const meta = templates[item.provider]
  const color = providerAccent(meta)
  const dimColor = meta?.template?.display?.accent ? `${color}22` : GENERIC_DIM

  return (
    <>
      {fontControls}
      {meta?.template ? (
        <TemplatedDetail
          template={meta.template}
          item={item.item as Record<string, unknown>}
          source={source}
          color={color}
          dimColor={dimColor}
          fontSizeOffset={fontSizeOffset}
          t={t}
        />
      ) : (
        <GenericContent
          item={item.item}
          color={color}
          dimColor={dimColor}
          providerLabel={providerLabel(meta, item.provider)}
          fontSizeOffset={fontSizeOffset}
        />
      )}
    </>
  )
}

function GenericContent({
  item,
  color,
  dimColor,
  providerLabel,
  fontSizeOffset,
}: {
  item: TaggedItem["item"]
  color: string
  dimColor: string
  providerLabel: string
  fontSizeOffset: number
}) {
  const content = typeof item.content === "string" ? item.content : ""
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

      {content && (
        <div
          className="text-muted-foreground leading-relaxed whitespace-pre-wrap"
          style={{ fontSize: `${15 + fontSizeOffset}px` }}
        >
          {content}
        </div>
      )}
    </div>
  )
}
