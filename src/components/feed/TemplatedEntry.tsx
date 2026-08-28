import type { ProviderTemplate } from "@/lib/providerTemplate"
import { resolveItemView } from "@/lib/providerTemplate"
import { formatDate } from "@/lib/utils"

interface TemplatedEntryProps {
  template: ProviderTemplate
  item: Record<string, unknown>
  source?: Record<string, unknown>
  color: string
}

/** Rend une entrée de liste à partir du template du connecteur — aucune
 *  connaissance du provider, tout vient de `template.list` + `template.item`. */
export function TemplatedEntry({ template, item, source, color }: TemplatedEntryProps) {
  const view = resolveItemView(template, item, source)
  const layout = template.list?.layout ?? "row"
  const date = view.timestamp ? formatDate(view.timestamp) : ""

  if (layout === "media") {
    return (
      <div className="flex gap-3">
        <div
          className="w-20 h-[45px] rounded shrink-0 flex items-center justify-center overflow-hidden"
          style={{ background: "var(--surface-2)" }}
        >
          {view.image ? (
            <img
              src={view.image}
              alt={view.title}
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
            {view.title || "—"}
          </p>
          <div className="flex items-center gap-2">
            {view.subtitle && (
              <span className="text-[13px] font-mono truncate" style={{ color }}>
                {view.subtitle}
              </span>
            )}
            {date && <span className="text-[13px] font-mono shrink-0 text-dim">{date}</span>}
          </div>
        </div>
      </div>
    )
  }

  const snippet = template.list?.snippet ? view.summary : ""

  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-0.5">
        <span className="text-[15px] font-medium line-clamp-1 text-foreground">
          {view.title || "—"}
        </span>
        {date && <span className="text-[13px] font-mono shrink-0 text-dim">{date}</span>}
      </div>
      {view.subtitle && (
        <p className="text-[13px] font-mono" style={{ color }}>
          {view.subtitle}
        </p>
      )}
      {snippet && (
        <p className="text-[14px] text-muted-foreground line-clamp-1 leading-relaxed">
          {snippet.slice(0, 160)}
        </p>
      )}
    </div>
  )
}
