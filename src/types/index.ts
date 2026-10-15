// The providers are the five StayUp collectors; how each one is rendered lives
// in src/lib/providers.ts. A provider with no template falls back to generic
// rendering.
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

// ─── A connector's content ──────────────────────────────────────────────────

// Minimal shape guaranteed by a provider's contract (see stayup-api).
// Everything else (connector-specific columns) goes through the index signature
// — the template knows how to read it.
export interface ConnectorItem {
  id: number
  repository_id: number
  content?: string
  datetime?: string | null
  version?: string | null
  executed_at: string
  success?: boolean
  params?: unknown
  [key: string]: unknown
}

// Name kept: several components and tests use it for "any row".
export type GenericItem = ConnectorItem

export interface TaggedItem {
  provider: string
  item: ConnectorItem
}

// The source (repository) associated with a row, as a template can read it
// via `$source.*`.
export interface FeedRepository {
  repository_id: number
  url: string
  provider?: string
  config?: Record<string, unknown>
}

export interface ConnectorData {
  connectors: Record<string, ConnectorItem[]>
}

// ─── Scrap ─────────────────────────────────────────────────────────────────────

/** An existing flux of a provider, with the user's subscription state. */
export interface ProviderFlux {
  id: number
  url: string
  config: Record<string, unknown>
  created_at: string
  is_subscribed: boolean
}
