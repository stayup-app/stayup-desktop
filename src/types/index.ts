// Un provider n'est plus une liste fermée : n'importe quel nom renvoyé par
// GET /connectors/providers est valide. Ces 4 noms restent seulement pour savoir quels
// providers ont un rendu riche dédié dans l'app — tout le reste retombe sur un rendu
// générique (voir isKnownProvider / isKnownTaggedItem).
export const KNOWN_PROVIDERS = ["changelog", "youtube", "rss", "scrap"] as const
export type KnownProvider = (typeof KNOWN_PROVIDERS)[number]

export function isKnownProvider(name: string): name is KnownProvider {
  return (KNOWN_PROVIDERS as readonly string[]).includes(name)
}

export type Provider = string

export interface UserRepository {
  id: string
  userId: string
  repositoryId: number
  provider: Provider // from repository.type
  url: string // from repository.url
  identifier: string // short form derived from url (e.g. "vercel/next.js", "melvynxdev")
  config: Record<string, unknown> // from repository.config (JSONB)
  createdAt: string
}

// ─── API raw types ─────────────────────────────────────────────────────────────

export interface ChangelogItem {
  id: number
  repository_id: number
  content: string
  diff: string | null
  datetime: string | null
  executed_at: string
  success: boolean
  version: string
}

export interface YoutubeItemContent {
  title: string
  thumbnail: string
  url: string // channel URL
  link?: string // video URL
}

export interface YoutubeItem {
  id: number
  repository_id: number
  version: string // video ID
  content: string // JSON string of YoutubeItemContent
  diff: string | null
  datetime: string | null
  executed_at: string
  success: boolean
}

export interface RssItemContent {
  version: string // entry id used as unique identifier
  title: string
  link: string
  summary: string
}

export interface RssItem {
  id: number
  repository_id: number
  content: string // JSON string of RssItemContent
  datetime: string | null
  executed_at: string
  success: boolean
}

export interface ScrapItemParams {
  url: string
  articles_selector: string
  content_selector: string
  [key: string]: string
}

export interface ScrapItem {
  id: number
  repository_id: number
  content: string // scraped text
  params: ScrapItemParams | string // JSONB from DB
  executed_at: string
  success: boolean
}

// Forme minimale garantie par le contrat d'un provider (voir stayup-api) pour tout
// provider sans rendu dédié dans l'app.
export interface GenericItem {
  id: number
  repository_id: number
  content: string
  datetime?: string | null
  version?: string | null
  executed_at: string
}

export type ConnectorItem = ChangelogItem | YoutubeItem | RssItem | ScrapItem | GenericItem

export type KnownTaggedItem =
  | { provider: "changelog"; item: ChangelogItem }
  | { provider: "youtube"; item: YoutubeItem }
  | { provider: "rss"; item: RssItem }
  | { provider: "scrap"; item: ScrapItem }

export type TaggedItem = KnownTaggedItem | { provider: string; item: GenericItem }

export function isKnownTaggedItem(tagged: TaggedItem): tagged is KnownTaggedItem {
  return isKnownProvider(tagged.provider)
}

export interface ConnectorData {
  connectors: Record<string, ConnectorItem[]>
}

// ─── Scrap ─────────────────────────────────────────────────────────────────────

export interface ScrapRepository {
  id: number
  url: string
  config: {
    articles_selector?: string
    content_selector?: string
    [key: string]: unknown
  }
  created_at: string
  is_subscribed: boolean
}

export interface ScrapRequest {
  id: string
  user_id: string
  user_email: string
  url: string
  status: "pending" | "approved" | "rejected"
  created_at: string
}
