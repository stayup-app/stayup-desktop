// Un provider n'est jamais codé en dur : la liste vient de GET /connectors/providers
// et le rendu de son `template` (provider_registry.template). Un provider sans
// template reconnu retombe sur le rendu générique.
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

// ─── Contenu d'un connecteur ─────────────────────────────────────────────────

// Forme minimale garantie par le contrat d'un provider (voir stayup-api). Tout le
// reste (colonnes propres au connecteur) passe par l'index de signature — c'est le
// template qui sait comment le lire.
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

// Nom conservé : plusieurs composants et tests l'emploient pour « une ligne quelconque ».
export type GenericItem = ConnectorItem

export interface TaggedItem {
  provider: string
  item: ConnectorItem
}

// La source (repository) associée à une ligne, telle qu'un template peut la lire
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

/** Un flux existant d'un provider, avec l'état d'abonnement de l'utilisateur. */
export interface ProviderFlux {
  id: number
  url: string
  config: Record<string, unknown>
  created_at: string
  is_subscribed: boolean
  /** Renseigné pour un flux vivant dans une base secondaire (sinon null). */
  dataSourceId?: number | null
  dataSourceName?: string | null
}
