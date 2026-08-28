import { useState, useEffect, useCallback } from "react"
import { getUserFeed, getConnectorProviders, type UserFeedResponse } from "@/lib/api"
import { readToken, readApiUrl } from "@/lib/store"
import { buildTemplateMap, resolveFeedLabel, type ProviderMeta } from "@/lib/providerTemplate"
import type { Provider } from "@/types"

export interface FeedFlux {
  id: string
  repository_id: number
  provider: Provider
  url: string
  identifier: string
}

interface FeedState {
  fluxes: FeedFlux[]
  connectors: UserFeedResponse["connectors"] | null
  templates: Record<string, ProviderMeta>
  loading: boolean
  error: string | null
}

interface UseFeed extends FeedState {
  refresh: () => void
}

export function useFeed(userId: string): UseFeed {
  const [state, setState] = useState<FeedState>({
    fluxes: [],
    connectors: null,
    templates: {},
    loading: true,
    error: null,
  })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const [token, apiUrl] = await Promise.all([readToken(), readApiUrl()])
      if (!token) throw new Error("Token manquant")

      const [data, providers] = await Promise.all([
        getUserFeed(userId, token, apiUrl),
        // Les templates ne doivent pas faire échouer le feed : sur erreur, map vide
        // (rendu générique).
        getConnectorProviders(token, apiUrl).catch(() => []),
      ])

      const templates = buildTemplateMap(providers)
      const fluxes: FeedFlux[] = data.repositories.map((r) => ({
        id: r.id,
        repository_id: r.repository_id,
        provider: r.provider,
        url: r.url,
        identifier: resolveFeedLabel(templates[r.provider]?.template ?? null, {
          url: r.url,
          config: (r.config ?? {}) as Record<string, unknown>,
        }),
      }))

      setState({
        fluxes,
        connectors: data.connectors,
        templates,
        loading: false,
        error: null,
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Erreur de chargement.",
      }))
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  return { ...state, refresh: load }
}
