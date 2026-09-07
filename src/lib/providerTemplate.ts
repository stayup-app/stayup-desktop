/**
 * Display template engine.
 *
 * A connector declares, in `provider_registry.template`, a JSON manifest that
 * tells the apps how to render its rows. stayup-api relays it as-is via
 * `GET /connectors/providers`. This file only *reads* it: it resolves accessors
 * (paths, `{x}` templates, formats) against a content row and its source, and
 * produces a flat object the `Templated*` components display.
 *
 * No per-connector logic here: adding a connector = adding a template in the
 * database, nothing to touch in the apps. A provider with no template (or an
 * unrecognized schema) falls back to generic rendering.
 *
 * The format is documented in stayup-api/docs/self-hosting-and-providers.md.
 */

// ─── Manifest types ────────────────────────────────────────────────────────

export type TplFormat =
  | "compactNumber"
  | "date"
  | "datetime"
  | "relativeTime"
  | "urlSlug"
  | "hostname"
  | "domain"
  | "stripMarkdown"
  | "upper"
  | "lower"

export type Accessor =
  | string
  | { path: string; format?: TplFormat; cases?: Record<string, string>; fallback?: string }
  | { template: string; format?: TplFormat }
  | Accessor[]

export interface TplColumn {
  label: string
  field: Accessor
  link?: Accessor
  align?: "left" | "right"
  width?: string
  format?: TplFormat
  prefix?: string
  muted?: boolean
  truncate?: boolean
  emphasis?: boolean
  accent?: boolean
}

export interface ProviderTemplate {
  version: number
  display?: {
    name?: string
    /** Built-in set key, SVG paths object, data URI, or http(s) image URL. */
    icon?: string | { paths?: string[]; d?: string; viewBox?: string; stroke?: boolean }
    accent?: string
    sortOrder?: number
    /** A flux's short label in the sidebar, evaluated against "$source". */
    feedLabel?: Accessor
  }
  item?: {
    parseContentAsJson?: boolean
    vars?: Record<string, Accessor>
    fields?: Partial<
      Record<
        "title" | "subtitle" | "summary" | "image" | "embedUrl" | "url" | "timestamp" | "version",
        Accessor
      >
    >
  }
  list?: {
    layout?: "row" | "media"
    primary?: string
    secondary?: string
    meta?: string
    thumbnail?: string
    snippet?: string
  }
  detail?: {
    mode?: "text" | "html" | "media" | "audio" | "gallery" | "table" | "link-list"
    title?: Accessor
    subtitle?: Accessor
    badge?: Accessor
    body?: Accessor
    image?: Accessor
    embedUrl?: Accessor
    audioUrl?: Accessor
    caption?: Accessor
    collection?: string
    columns?: TplColumn[]
    rowLink?: Accessor
    openUrl?: Accessor
    openLabel?: string
  }
  form?: {
    label?: string
    placeholder?: string
    /** "{value}" = what the user types. Ignored if the value is already an http(s) URL. */
    urlTemplate?: string
    /** Shape regex, validated client-side. */
    pattern?: string
    transform?: {
      trim?: boolean
      stripPrefix?: string | string[]
      stripSuffix?: string | string[]
      /** Regex; if it matches, we keep group 1. */
      extract?: string
    }
  }
}

// ─── Chargement ──────────────────────────────────────────────────────────────

/** Roughly validates a raw template. Returns null if unusable. */
export function normalizeTemplate(raw: unknown): ProviderTemplate | null {
  let value = raw
  if (typeof value === "string") {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== "object") return null
  const tpl = value as ProviderTemplate
  // An unknown version: we prefer generic rendering over partial rendering.
  if (tpl.version !== 1) return null
  return tpl
}

export interface ProviderMeta {
  name: string
  displayName: string
  template: ProviderTemplate | null
}

/** Indexes the GET /connectors/providers response by provider name. */
export function buildTemplateMap(
  providers: { name: string; displayName?: string; template?: unknown }[] | undefined,
): Record<string, ProviderMeta> {
  const map: Record<string, ProviderMeta> = {}
  for (const p of providers ?? []) {
    map[p.name] = {
      name: p.name,
      displayName: p.displayName ?? p.name,
      template: normalizeTemplate(p.template),
    }
  }
  return map
}

// ─── Resolution ────────────────────────────────────────────────────────────

export interface ResolveCtx {
  row: Record<string, unknown>
  source: Record<string, unknown>
  base: unknown
  vars: Record<string, unknown>
}

function isEmpty(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "")
}

function maybeJson(v: unknown): unknown {
  if (typeof v !== "string") return v
  const t = v.trim()
  if (!t.startsWith("{") && !t.startsWith("[")) return v
  try {
    return JSON.parse(t)
  } catch {
    return v
  }
}

function walk(rootRaw: unknown, segments: string[]): unknown {
  let cur: unknown = rootRaw
  for (let i = 0; i < segments.length; i++) {
    if (cur == null) return undefined
    if (typeof cur === "string") cur = maybeJson(cur)
    if (typeof cur !== "object") return undefined
    cur = (cur as Record<string, unknown>)[segments[i]]
  }
  return cur
}

function resolvePath(pathStr: string, ctx: ResolveCtx): unknown {
  const path = pathStr.trim()
  if (path === "content") return String(ctx.row.content ?? "")
  const segs = path.split(".")
  const [head, ...rest] = segs
  if (head === "$row") return walk(ctx.row, rest)
  if (head === "$source") return walk(ctx.source, rest)
  if (head === "$vars") return walk(ctx.vars, rest)
  // `$self` = the current base value (useful for a collection of bare URLs).
  if (head === "$self") return rest.length === 0 ? ctx.base : walk(ctx.base, rest)
  // A plain name (`{repo}`, `{window}`) first refers to a computed var, then,
  // failing that, a content key.
  if (segs.length === 1 && Object.prototype.hasOwnProperty.call(ctx.vars, head)) {
    return ctx.vars[head]
  }
  return walk(ctx.base, segs)
}

export function applyFormat(value: unknown, format: TplFormat | undefined): unknown {
  if (format == null || value == null) return value
  const s = String(value)
  switch (format) {
    case "compactNumber": {
      const n = Number(value)
      if (!Number.isFinite(n)) return value
      return new Intl.NumberFormat(undefined, {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(n)
    }
    case "date":
      return safeDate(s, { dateStyle: "medium" })
    case "datetime":
      return safeDate(s, { dateStyle: "medium", timeStyle: "short" })
    case "relativeTime":
      return safeDate(s, { dateStyle: "medium", timeStyle: "short" })
    case "urlSlug":
      try {
        return new URL(s).pathname.replace(/^\/+/, "").replace(/\/+$/, "")
      } catch {
        return s
      }
    case "hostname":
      try {
        return new URL(s).hostname.replace(/^www\./, "")
      } catch {
        return s
      }
    case "domain":
      // Hostname without `www.` or the last segment: blog.stephane-robert.info
      // → blog.stephane-robert. Short label for rss / scrap fluxes.
      try {
        const host = new URL(s).hostname.replace(/^www\./, "")
        const parts = host.split(".")
        return parts.length > 1 ? parts.slice(0, -1).join(".") : host
      } catch {
        return s
      }
    case "stripMarkdown":
      return s
        .replace(/#{1,6}\s/g, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
    case "upper":
      return s.toUpperCase()
    case "lower":
      return s.toLowerCase()
    default:
      return value
  }
}

function safeDate(s: string, opts: Intl.DateTimeFormatOptions): string {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return new Intl.DateTimeFormat("fr-FR", opts).format(d)
}

function fillTemplate(tpl: string, ctx: ResolveCtx): string {
  return tpl.replace(/\{([^}]+)\}/g, (_, expr) => {
    const v = resolvePath(String(expr), ctx)
    return isEmpty(v) ? "" : String(v)
  })
}

/** Resolves an accessor to a raw value (string/number/null/object as the case may be). */
export function resolveAccessor(acc: Accessor | undefined, ctx: ResolveCtx): unknown {
  if (acc == null) return null

  if (Array.isArray(acc)) {
    for (const a of acc) {
      const v = resolveAccessor(a, ctx)
      if (!isEmpty(v)) return v
    }
    return null
  }

  if (typeof acc === "string") {
    if (acc.includes("{")) return fillTemplate(acc, ctx)
    return resolvePath(acc, ctx)
  }

  if ("template" in acc) {
    return applyFormat(fillTemplate(acc.template, ctx), acc.format)
  }

  let v = resolvePath(acc.path, ctx)
  if (acc.cases && !isEmpty(v) && String(v) in acc.cases) v = acc.cases[String(v)]
  v = applyFormat(v, acc.format)
  if (isEmpty(v) && acc.fallback != null) return acc.fallback
  return v
}

/** Like resolveAccessor, but guarantees a string ('' if empty). */
export function resolveText(acc: Accessor | undefined, ctx: ResolveCtx): string {
  const v = resolveAccessor(acc, ctx)
  return isEmpty(v) ? "" : String(v)
}

// ─── An item's view ────────────────────────────────────────────────────────

export interface ItemView {
  title: string
  subtitle: string
  summary: string
  image: string | null
  url: string | null
  timestamp: string
  ctx: ResolveCtx
}

/** Builds the resolution context for a content row and its source. */
export function makeCtx(
  template: ProviderTemplate,
  row: Record<string, unknown>,
  source: Record<string, unknown> | undefined,
): ResolveCtx {
  let base: unknown = row
  if (template.item?.parseContentAsJson) {
    try {
      base = JSON.parse(String(row.content ?? "")) ?? row
    } catch {
      base = row
    }
  }
  const ctx: ResolveCtx = { row, source: source ?? {}, base, vars: {} }
  for (const [key, acc] of Object.entries(template.item?.vars ?? {})) {
    ctx.vars[key] = resolveAccessor(acc, ctx)
  }
  return ctx
}

export function resolveItemView(
  template: ProviderTemplate,
  row: Record<string, unknown>,
  source: Record<string, unknown> | undefined,
): ItemView {
  const ctx = makeCtx(template, row, source)
  const f = template.item?.fields ?? {}
  const ts = resolveAccessor(f.timestamp, ctx)
  return {
    title: resolveText(f.title, ctx),
    subtitle: resolveText(f.subtitle, ctx),
    summary: resolveText(f.summary, ctx),
    image: resolveText(f.image, ctx) || null,
    url: resolveText(f.url, ctx) || null,
    timestamp: isEmpty(ts) ? String(row.datetime ?? row.executed_at ?? "") : String(ts),
    ctx,
  }
}

/** Resolves the inner collection of a `table` / `link-list` template. */
export function resolveCollection(
  template: ProviderTemplate,
  ctx: ResolveCtx,
): Record<string, unknown>[] {
  const path = template.detail?.collection
  if (!path) return []
  const arr = resolvePath(path, ctx)
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []
}

/** Derived context for a collection element (accesses relative to the element). */
export function elementCtx(ctx: ResolveCtx, element: Record<string, unknown>): ResolveCtx {
  return { row: ctx.row, source: ctx.source, base: element, vars: ctx.vars }
}

/** An embed URL is only used if it points to a real id. */
export function usableEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (!/^https?:\/\//.test(url)) return null
  if (!/\/embed\/[\w-]{4,}/.test(url) && !/[?&]v=[\w-]{4,}/.test(url)) return null
  return url
}

/** A row's external "open" URL, for keyboard shortcuts — same rules as the
 *  reading pane's button (detail.openUrl, otherwise fields.url). */
export function resolveOpenUrl(
  template: ProviderTemplate,
  row: Record<string, unknown>,
  source: Record<string, unknown> | undefined,
): string | null {
  const ctx = makeCtx(template, row, source)
  const href = resolveText(template.detail?.openUrl ?? template.item?.fields?.url, ctx)
  try {
    const u = new URL(href)
    if ((u.protocol === "http:" || u.protocol === "https:") && !u.pathname.startsWith("//")) {
      return href
    }
  } catch {
    /* not a URL */
  }
  return null
}

// ─── A provider's icon ──────────────────────────────────────────────────────

export type IconSpec =
  | { kind: "named"; name: string }
  | { kind: "svg"; paths: string[]; viewBox: string; stroke: boolean }
  | { kind: "image"; src: string }

/**
 * Normalizes `display.icon`. Order of preference:
 * 1. object `{ paths | d, viewBox }` → tintable SVG path;
 * 2. `data:` or `http(s)://` string → image;
 * 3. any other string → key of the built-in icon set;
 * 4. absent → `dot`.
 */
export function resolveIcon(icon: ProviderTemplate["display"]): IconSpec {
  const raw = icon?.icon
  if (raw && typeof raw === "object") {
    const paths = raw.paths ?? (raw.d ? [raw.d] : [])
    if (paths.length > 0)
      return { kind: "svg", paths, viewBox: raw.viewBox || "0 0 24 24", stroke: !!raw.stroke }
  }
  if (typeof raw === "string") {
    if (/^data:|^https?:\/\//.test(raw)) return { kind: "image", src: raw }
    if (raw) return { kind: "named", name: raw }
  }
  return { kind: "named", name: "dot" }
}

// ─── A flux's short label ───────────────────────────────────────────────────

/** Strips the scheme and `www.` from a URL — the fallback when there is no `feedLabel`. */
export function stripScheme(url: string): string {
  return String(url)
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/+$/, "")
}

/** Resolves `display.feedLabel` against a source (repository), otherwise a generic fallback. */
export function resolveFeedLabel(
  template: ProviderTemplate | null | undefined,
  source: Record<string, unknown>,
): string {
  const acc = template?.display?.feedLabel
  if (acc) {
    const ctx: ResolveCtx = { row: {}, source, base: {}, vars: {} }
    const v = resolveText(acc, ctx)
    if (v) return v
  }
  return stripScheme(String(source.url ?? ""))
}

// ─── "Add a flux" form ─────────────────────────────────────────────────────

function asList(v: string | string[] | undefined): string[] {
  return v == null ? [] : Array.isArray(v) ? v : [v]
}

/** Applies `form.transform` to the user input. */
export function applyFormTransform(
  raw: string,
  transform: NonNullable<ProviderTemplate["form"]>["transform"],
): string {
  let v = raw
  if (!transform) return v.trim()
  if (transform.trim !== false) v = v.trim()
  if (transform.extract) {
    try {
      const m = v.match(new RegExp(transform.extract))
      if (m && m[1]) v = m[1]
    } catch {
      /* invalid regex: ignore */
    }
  }
  for (const p of asList(transform.stripPrefix)) if (v.startsWith(p)) v = v.slice(p.length)
  for (const sfx of asList(transform.stripSuffix)) if (v.endsWith(sfx)) v = v.slice(0, -sfx.length)
  return v
}

/**
 * Builds the `repository` URL from `form` and the input.
 * If the transformed value is already an http(s) URL, we keep it as-is.
 */
export function buildFluxUrl(form: ProviderTemplate["form"] | undefined, input: string): string {
  const value = applyFormTransform(input, form?.transform)
  if (/^https?:\/\//.test(value)) return value
  if (form?.urlTemplate) return form.urlTemplate.replace("{value}", value)
  return value
}

/** Does the input satisfy `form.pattern`? (true if there is no pattern) */
export function matchesFormPattern(
  form: ProviderTemplate["form"] | undefined,
  input: string,
): boolean {
  if (!form?.pattern) return true
  try {
    return new RegExp(form.pattern).test(applyFormTransform(input, form.transform))
  } catch {
    return true
  }
}
