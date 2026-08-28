import type { ProviderTemplate, ResolveCtx, TplColumn } from "@/lib/providerTemplate"
import {
  applyFormat,
  elementCtx,
  makeCtx,
  resolveAccessor,
  resolveCollection,
  resolveText,
  usableEmbedUrl,
} from "@/lib/providerTemplate"
import { formatDate, openUrl } from "@/lib/utils"
import type { Translations } from "@/lib/translations"

interface TemplatedDetailProps {
  template: ProviderTemplate
  item: Record<string, unknown>
  source?: Record<string, unknown>
  color: string
  dimColor: string
  fontSizeOffset: number
  t: Translations
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

function LinkText({ href, color, children }: { href: string; color: string; children: string }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        void openUrl(href)
      }}
      className="hover:underline"
      style={{ color }}
    >
      {children}
    </a>
  )
}

const getRssStyles = (color: string, fontSize: number) => `
  .tpl-html { font-size: ${fontSize}px; line-height: 1.65; color: var(--fg-soft); }
  .tpl-html p { margin: 0 0 0.9em; }
  .tpl-html a { color: ${color}; text-decoration: underline; }
  .tpl-html h1, .tpl-html h2, .tpl-html h3 { color: var(--fg); margin: 1.2em 0 0.4em; font-weight: 600; font-size: ${fontSize + 1}px; }
  .tpl-html ul, .tpl-html ol { padding-left: 1.5em; margin: 0 0 0.9em; }
  .tpl-html li { line-height: 1.65; }
  .tpl-html img { max-width: 100%; height: auto; border-radius: 4px; margin: 0.5em 0; }
  .tpl-html code { background: var(--surface); color: var(--peach); padding: 1px 6px; border-radius: 4px; font-size: ${fontSize - 1}px; font-family: 'JetBrains Mono', monospace; }
  .tpl-html pre { background: var(--bg-soft); border: 1px solid var(--border-soft); padding: 12px; border-radius: 10px; overflow-x: auto; margin: 0 0 0.9em; }
  .tpl-html blockquote { border-left: 3px solid var(--peach); background: var(--peach-dim); padding: 10px 16px; margin: 0 0 0.9em; border-radius: 0 8px 8px 0; font-style: italic; }
`

function cellFormat(raw: unknown, col: TplColumn): string {
  if (raw == null || raw === "") return ""
  const formatted = applyFormat(raw, col.format)
  if (formatted == null || formatted === "") return ""
  return col.prefix ? `${col.prefix}${formatted}` : String(formatted)
}

/** Un lien « Ouvrir » n'est rendu que si l'accesseur a produit une URL absolue
 *  saine — un gabarit dont un `{token}` s'est résolu à vide laisse un chemin
 *  malformé (`https://host//…`) qu'on ne veut pas afficher. */
function absoluteUrl(s: string): string {
  try {
    const u = new URL(s)
    if (u.protocol !== "http:" && u.protocol !== "https:") return ""
    if (u.pathname.startsWith("//")) return ""
    return s
  } catch {
    return ""
  }
}

/** Rend le volet de lecture depuis le template — `detail.mode` pilote tout. */
export function TemplatedDetail({
  template,
  item,
  source,
  color,
  dimColor,
  fontSizeOffset,
  t,
}: TemplatedDetailProps) {
  const d = template.detail ?? {}
  const ctx: ResolveCtx = makeCtx(template, item, source)
  const fields = template.item?.fields ?? {}

  const title = resolveText(d.title ?? fields.title, ctx)
  const subtitle = resolveText(d.subtitle, ctx)
  const badge = resolveText(d.badge, ctx)
  const dateRaw = resolveAccessor(fields.timestamp, ctx)
  const date = dateRaw
    ? formatDate(String(dateRaw))
    : formatDate(String(item.datetime ?? item.executed_at ?? ""))
  const openHref = absoluteUrl(resolveText(d.openUrl ?? fields.url, ctx))
  const openLabel = d.openLabel || t.viewer.openLink
  const mode = d.mode ?? "text"

  const header = (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      {title && (
        <span className="font-serif text-[22px] leading-tight text-foreground w-full">{title}</span>
      )}
      {badge && (
        <span
          className="text-[13px] font-mono font-semibold px-1.5 py-0.5 rounded"
          style={{ background: dimColor, color }}
        >
          {badge}
        </span>
      )}
      {subtitle && (
        <span className="text-[14px] font-mono" style={{ color }}>
          {subtitle}
        </span>
      )}
      {date && <span className="ml-auto text-[13px] font-mono text-dim">{date}</span>}
    </div>
  )

  if (mode === "table") {
    const rows = resolveCollection(template, ctx)
    const cols = d.columns ?? []
    return (
      <div className="p-6 max-w-4xl">
        {header}
        <div
          className="overflow-x-auto rounded border"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {cols.map((col, i) => (
                  <th
                    key={i}
                    className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-3 py-2"
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      background: "var(--surface-2)",
                      width: col.width,
                      textAlign: col.align === "right" ? "right" : "left",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((el, ri) => {
                const ectx = elementCtx(ctx, el)
                const rowHref = resolveText(d.rowLink, ectx)
                return (
                  <tr key={ri}>
                    {cols.map((col, ci) => {
                      const value = cellFormat(resolveAccessor(col.field, ectx), col)
                      const link = col.link ? resolveText(col.link, ectx) : rowHref
                      const asLink = link && (col.link || (ci === 0 && rowHref))
                      return (
                        <td
                          key={ci}
                          className="px-3 py-2 align-top"
                          style={{
                            borderTop: ri === 0 ? undefined : "1px solid var(--border-subtle)",
                            textAlign: col.align === "right" ? "right" : "left",
                            color: col.accent
                              ? color
                              : col.muted
                                ? "var(--muted-foreground)"
                                : "var(--fg-soft)",
                            fontWeight: col.emphasis ? 600 : undefined,
                            fontVariantNumeric: col.align === "right" ? "tabular-nums" : undefined,
                            maxWidth: col.truncate ? 320 : undefined,
                            whiteSpace: col.truncate ? "nowrap" : undefined,
                            overflow: col.truncate ? "hidden" : undefined,
                            textOverflow: col.truncate ? "ellipsis" : undefined,
                          }}
                        >
                          {asLink ? (
                            <LinkText href={link} color={color}>
                              {value}
                            </LinkText>
                          ) : (
                            value
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {openHref && (
          <OpenButton href={openHref} label={openLabel} color={color} dimColor={dimColor} />
        )}
      </div>
    )
  }

  if (mode === "link-list") {
    const rows = resolveCollection(template, ctx)
    return (
      <div className="p-6 max-w-2xl">
        {header}
        <ul className="space-y-2">
          {rows.map((el, i) => {
            const ectx = elementCtx(ctx, el)
            const label = resolveText(d.columns?.[0]?.field ?? "title", ectx)
            const href = resolveText(d.rowLink ?? "url", ectx)
            return (
              <li key={i} className="text-[15px]">
                {href ? (
                  <LinkText href={href} color={color}>
                    {label || href}
                  </LinkText>
                ) : (
                  <span className="text-foreground">{label}</span>
                )}
              </li>
            )
          })}
        </ul>
        {openHref && (
          <OpenButton href={openHref} label={openLabel} color={color} dimColor={dimColor} />
        )}
      </div>
    )
  }

  if (mode === "media") {
    const embed = usableEmbedUrl(resolveText(d.embedUrl ?? fields.embedUrl, ctx))
    const image = resolveText(d.image ?? fields.image, ctx)
    return (
      <div className="p-6 max-w-2xl">
        {header}
        <div
          className="mb-5 rounded overflow-hidden"
          style={{ aspectRatio: "16/9", maxWidth: 640 }}
        >
          {embed ? (
            <iframe
              src={embed}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={title}
            />
          ) : image ? (
            <img src={image} alt={title} className="w-full h-full object-cover" loading="lazy" />
          ) : null}
        </div>
        {openHref && (
          <OpenButton href={openHref} label={openLabel} color={color} dimColor={dimColor} />
        )}
      </div>
    )
  }

  if (mode === "audio") {
    const src = absoluteUrl(resolveText(d.audioUrl, ctx))
    const cover = resolveText(d.image ?? fields.image, ctx)
    const notes = resolveText(d.body ?? fields.summary, ctx)
    return (
      <div className="p-6 max-w-2xl">
        {header}
        {cover && (
          <div className="mb-4 rounded overflow-hidden" style={{ aspectRatio: "1", maxWidth: 240 }}>
            <img src={cover} alt={title} className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
        {src && (
          <audio controls src={src} className="w-full mb-4" style={{ maxWidth: 560 }}>
            <track kind="captions" />
          </audio>
        )}
        {notes && (
          <div
            className="text-muted-foreground leading-relaxed whitespace-pre-wrap"
            style={{ fontSize: `${15 + fontSizeOffset}px` }}
          >
            {notes}
          </div>
        )}
        {openHref && (
          <OpenButton href={openHref} label={openLabel} color={color} dimColor={dimColor} />
        )}
      </div>
    )
  }

  if (mode === "gallery") {
    const shots = resolveCollection(template, ctx)
    return (
      <div className="p-6 max-w-3xl">
        {header}
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
        >
          {shots.map((el, i) => {
            const ectx = elementCtx(ctx, el)
            const src = resolveText(d.image ?? "$self", ectx)
            const link = resolveText(d.rowLink, ectx)
            const cap = resolveText(d.caption, ectx)
            if (!src) return null
            const img = (
              <div
                className="rounded overflow-hidden w-full"
                style={{ aspectRatio: "1", background: "var(--surface-2)" }}
              >
                <img src={src} alt={cap} className="w-full h-full object-cover" loading="lazy" />
              </div>
            )
            return (
              <figure key={i} className="m-0">
                {link ? (
                  <a
                    href={link}
                    onClick={(e) => {
                      e.preventDefault()
                      void openUrl(link)
                    }}
                  >
                    {img}
                  </a>
                ) : (
                  img
                )}
                {cap && (
                  <figcaption className="mt-1 text-[13px] text-muted-foreground">{cap}</figcaption>
                )}
              </figure>
            )
          })}
        </div>
        {openHref && (
          <OpenButton href={openHref} label={openLabel} color={color} dimColor={dimColor} />
        )}
      </div>
    )
  }

  const body = resolveText(d.body ?? fields.summary, ctx)

  if (mode === "html") {
    return (
      <div className="p-6 max-w-2xl">
        {header}
        {body && (
          <>
            <style>{getRssStyles(color, 15 + fontSizeOffset)}</style>
            <div className="tpl-html" dangerouslySetInnerHTML={{ __html: body }} />
          </>
        )}
        {openHref && (
          <OpenButton href={openHref} label={openLabel} color={color} dimColor={dimColor} />
        )}
      </div>
    )
  }

  // mode === "text"
  return (
    <div className="p-6 max-w-2xl">
      {header}
      {body && (
        <div
          className="text-muted-foreground leading-relaxed whitespace-pre-wrap"
          style={{ fontSize: `${15 + fontSizeOffset}px` }}
        >
          {body}
        </div>
      )}
      {openHref && (
        <OpenButton href={openHref} label={openLabel} color={color} dimColor={dimColor} />
      )}
    </div>
  )
}
