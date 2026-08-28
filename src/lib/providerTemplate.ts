/**
 * Moteur de templates d'affichage.
 *
 * Un connecteur déclare, dans `provider_registry.template`, un manifeste JSON qui
 * dit aux apps comment rendre ses lignes. stayup-api le relaie tel quel via
 * `GET /connectors/providers`. Ce fichier ne fait que le *lire* : il résout des
 * accesseurs (chemins, gabarits `{x}`, formats) contre une ligne de contenu et sa
 * source, et rend un objet plat que les composants `Templated*` affichent.
 *
 * Aucune logique par-connecteur ici : ajouter un connecteur = ajouter un template
 * en base, rien à toucher dans les apps. Un provider sans template (ou au schéma
 * non reconnu) retombe sur le rendu générique.
 *
 * Le format est documenté dans stayup-api/docs/self-hosting-and-providers.md.
 */

// ─── Types du manifeste ──────────────────────────────────────────────────────

export type TplFormat =
  | "compactNumber"
  | "date"
  | "datetime"
  | "relativeTime"
  | "urlSlug"
  | "hostname"
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
    /** Clé du jeu intégré, objet de tracés SVG, data-URI, ou URL http(s) d'image. */
    icon?: string | { paths?: string[]; d?: string; viewBox?: string; stroke?: boolean }
    accent?: string
    sortOrder?: number
    /** Libellé court d'un flux dans la sidebar, évalué contre "$source". */
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
    /** "{value}" = ce que l'utilisateur saisit. Ignoré si la valeur est déjà une URL http(s). */
    urlTemplate?: string
    /** Regex de forme, validée côté client. */
    pattern?: string
    transform?: {
      trim?: boolean
      stripPrefix?: string | string[]
      stripSuffix?: string | string[]
      /** Regex ; si elle matche, on garde le groupe 1. */
      extract?: string
    }
  }
}

// ─── Chargement ──────────────────────────────────────────────────────────────

/** Valide grossièrement un template brut. Renvoie null si inexploitable. */
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
  // Une version inconnue : on préfère le rendu générique à un rendu partiel.
  if (tpl.version !== 1) return null
  return tpl
}

export interface ProviderMeta {
  name: string
  displayName: string
  template: ProviderTemplate | null
}

/** Indexe la réponse de GET /connectors/providers par nom de provider. */
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

// ─── Résolution ──────────────────────────────────────────────────────────────

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
  // `$self` = la valeur de base courante (utile pour une collection d'URLs nues).
  if (head === "$self") return rest.length === 0 ? ctx.base : walk(ctx.base, rest)
  // Un nom simple (`{repo}`, `{window}`) désigne d'abord une var calculée, puis,
  // à défaut, une clé du contenu.
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

/** Résout un accesseur en valeur brute (string/number/null/objet selon le cas). */
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

/** Comme resolveAccessor, mais garantit une chaîne ('' si vide). */
export function resolveText(acc: Accessor | undefined, ctx: ResolveCtx): string {
  const v = resolveAccessor(acc, ctx)
  return isEmpty(v) ? "" : String(v)
}

// ─── Vue d'un item ───────────────────────────────────────────────────────────

export interface ItemView {
  title: string
  subtitle: string
  summary: string
  image: string | null
  url: string | null
  timestamp: string
  ctx: ResolveCtx
}

/** Construit le contexte de résolution d'une ligne de contenu et de sa source. */
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

/** Résout la collection interne d'un template `table` / `link-list`. */
export function resolveCollection(
  template: ProviderTemplate,
  ctx: ResolveCtx,
): Record<string, unknown>[] {
  const path = template.detail?.collection
  if (!path) return []
  const arr = resolvePath(path, ctx)
  return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : []
}

/** Contexte dérivé pour un élément de collection (accès relatifs à l'élément). */
export function elementCtx(ctx: ResolveCtx, element: Record<string, unknown>): ResolveCtx {
  return { row: ctx.row, source: ctx.source, base: element, vars: ctx.vars }
}

/** Une URL d'embed n'est utilisée que si elle pointe vers un identifiant réel. */
export function usableEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (!/^https?:\/\//.test(url)) return null
  if (!/\/embed\/[\w-]{4,}/.test(url) && !/[?&]v=[\w-]{4,}/.test(url)) return null
  return url
}

/** URL externe « ouvrir » d'une ligne, pour les raccourcis clavier — mêmes règles
 *  que le bouton du volet de lecture (detail.openUrl, sinon fields.url). */
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

// ─── Icône d'un provider ─────────────────────────────────────────────────────

export type IconSpec =
  | { kind: "named"; name: string }
  | { kind: "svg"; paths: string[]; viewBox: string; stroke: boolean }
  | { kind: "image"; src: string }

/**
 * Normalise `display.icon`. Ordre de préférence :
 * 1. objet `{ paths | d, viewBox }` → tracé SVG teintable ;
 * 2. chaîne `data:` ou `http(s)://` → image ;
 * 3. autre chaîne → clé du jeu d'icônes intégré ;
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

// ─── Libellé court d'un flux ─────────────────────────────────────────────────

/** Retire le schéma et `www.` d'une URL — le repli quand aucun `feedLabel`. */
export function stripScheme(url: string): string {
  return String(url)
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\/+$/, "")
}

/** Résout `display.feedLabel` contre une source (repository), sinon repli générique. */
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

// ─── Formulaire « ajouter un flux » ──────────────────────────────────────────

function asList(v: string | string[] | undefined): string[] {
  return v == null ? [] : Array.isArray(v) ? v : [v]
}

/** Applique `form.transform` à la saisie utilisateur. */
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
      /* regex invalide : on ignore */
    }
  }
  for (const p of asList(transform.stripPrefix)) if (v.startsWith(p)) v = v.slice(p.length)
  for (const sfx of asList(transform.stripSuffix)) if (v.endsWith(sfx)) v = v.slice(0, -sfx.length)
  return v
}

/**
 * Construit l'URL de `repository` à partir de `form` et de la saisie.
 * Si la valeur transformée est déjà une URL http(s), on la garde telle quelle.
 */
export function buildFluxUrl(form: ProviderTemplate["form"] | undefined, input: string): string {
  const value = applyFormTransform(input, form?.transform)
  if (/^https?:\/\//.test(value)) return value
  if (form?.urlTemplate) return form.urlTemplate.replace("{value}", value)
  return value
}

/** La saisie respecte-t-elle `form.pattern` ? (true si pas de pattern) */
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
