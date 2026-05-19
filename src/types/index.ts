export type Provider = "changelog" | "youtube" | "rss" | "scrap" | "documentation"

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

export type ConnectorItem = ChangelogItem | YoutubeItem | RssItem | ScrapItem

export type TaggedItem =
  | { provider: "changelog"; item: ChangelogItem }
  | { provider: "youtube"; item: YoutubeItem }
  | { provider: "rss"; item: RssItem }
  | { provider: "scrap"; item: ScrapItem }

export interface ConnectorData {
  connectors: {
    changelog?: ChangelogItem[]
    youtube?: YoutubeItem[]
    rss?: RssItem[]
    scrap?: ScrapItem[]
  }
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

// ─── Documentation ─────────────────────────────────────────────────────────────

export interface DocRegistry {
  id: number
  name: string
  url: string
  created_at: string
  is_subscribed: boolean
  current_version: number | null
  last_scraped_at: string | null
}

export interface DocContent {
  id: number
  content: string
  version: number
  scraped_at: string
}

export interface DocVersion {
  id: number
  version: number
  is_current: boolean
  scraped_at: string
  archived_at: string | null
  has_diff: boolean
}
