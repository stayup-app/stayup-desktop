import { useState, useEffect, useCallback } from "react"
import { getUserFeed, getConnectorProviders, ApiError, type UserFeedResponse } from "@/lib/api"
import { decodeToken, isTokenExpired } from "@/lib/session"
import type { Instance } from "@/lib/store"
import { buildTemplateMap, resolveFeedLabel, type ProviderMeta } from "@/lib/providerTemplate"
import type { Provider } from "@/types"

export interface FeedFlux {
  id: string
  repository_id: number
  provider: Provider
  url: string
  identifier: string
  instanceId: string
  instanceName: string
}

/** Pourquoi une instance manque au feed :
 *  - `expired`     : le token est expiré (exp dépassé), constaté localement ;
 *  - `auth`        : l'API a refusé le token (401/403) — révoqué côté serveur ;
 *  - `unreachable` : réseau ou 5xx, probablement transitoire.
 *  `expired` et `auth` demandent une reconnexion ; `unreachable` un simple retry. */
export type InstanceErrorReason = "expired" | "auth" | "unreachable"

/** Un connecteur inaccessible ou expiré : sa tranche du feed manque, on l'affiche
 *  sans casser le reste. */
export interface InstanceError {
  instanceId: string
  instanceName: string
  reason: InstanceErrorReason
}

/** Les instances dont la session est morte (token expiré ou rejeté) : il faut se
 *  reconnecter, un simple retry n'y changera rien. */
export function needsReconnect(errors: InstanceError[]): InstanceError[] {
  return errors.filter((e) => e.reason === "expired" || e.reason === "auth")
}

interface FeedState {
  fluxes: FeedFlux[]
  connectors: UserFeedResponse["connectors"] | null
  templates: Record<string, ProviderMeta>
  instanceErrors: InstanceError[]
  loading: boolean
  error: string | null
}

interface UseFeed extends FeedState {
  refresh: () => void
}

/** Fusionne les templates de plusieurs instances : premier vu gagne, sauf pour
 *  compléter un template manquant. */
function mergeTemplates(maps: Record<string, ProviderMeta>[]): Record<string, ProviderMeta> {
  const out: Record<string, ProviderMeta> = {}
  for (const map of maps) {
    for (const [name, meta] of Object.entries(map)) {
      const cur = out[name]
      if (!cur) out[name] = meta
      else if (!cur.template && meta.template) out[name] = { ...cur, template: meta.template }
    }
  }
  return out
}

export function useFeed(instances: Instance[]): UseFeed {
  const [state, setState] = useState<FeedState>({
    fluxes: [],
    connectors: null,
    templates: {},
    instanceErrors: [],
    loading: true,
    error: null,
  })

  // Signature stable : ne relance le fan-out que si la liste (id + token) change.
  const key = instances.map((i) => `${i.id}:${i.token.slice(-12)}`).join("|")

  const load = useCallback(async () => {
    const live = instances.filter((i) => i.token && !isTokenExpired(i.token))
    const expired = instances.filter((i) => i.token && isTokenExpired(i.token))

    const results = await Promise.all(
      live.map(async (inst) => {
        try {
          const userId = decodeToken(inst.token).userId
          const [data, providers] = await Promise.all([
            getUserFeed(userId, inst.token, inst.url),
            getConnectorProviders(inst.token, inst.url).catch(() => []),
          ])
          return { inst, data, providers, ok: true as const }
        } catch (e) {
          // 401/403 = token rejeté (à reconnecter) ; le reste = injoignable (à réessayer).
          const reason: InstanceErrorReason =
            e instanceof ApiError && (e.status === 401 || e.status === 403) ? "auth" : "unreachable"
          return { inst, ok: false as const, reason }
        }
      }),
    )

    const templates = mergeTemplates(
      results.filter((r) => r.ok).map((r) => buildTemplateMap(r.providers!)),
    )

    const connectors: UserFeedResponse["connectors"] = {}
    const fluxes: FeedFlux[] = []
    const instanceErrors: InstanceError[] = [
      ...expired.map((i) => ({
        instanceId: i.id,
        instanceName: i.name,
        reason: "expired" as const,
      })),
    ]

    for (const r of results) {
      if (!r.ok) {
        instanceErrors.push({
          instanceId: r.inst.id,
          instanceName: r.inst.name,
          reason: r.reason,
        })
        continue
      }
      for (const [provider, items] of Object.entries(r.data.connectors ?? {})) {
        const tagged = items.map((it) => ({
          ...it,
          _instance_id: r.inst.id,
          _instance_name: r.inst.name,
        }))
        connectors[provider] = [...(connectors[provider] ?? []), ...tagged]
      }
      for (const repo of r.data.repositories) {
        fluxes.push({
          id: repo.id,
          repository_id: repo.repository_id,
          provider: repo.provider,
          url: repo.url,
          identifier: resolveFeedLabel(templates[repo.provider]?.template ?? null, {
            url: repo.url,
            config: (repo.config ?? {}) as Record<string, unknown>,
          }),
          instanceId: r.inst.id,
          instanceName: r.inst.name,
        })
      }
    }

    setState({
      fluxes,
      connectors: results.some((r) => r.ok) || instances.length === 0 ? connectors : null,
      templates,
      instanceErrors,
      loading: false,
      error: !results.some((r) => r.ok) && live.length > 0 ? "Erreur de chargement." : null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    // Chargement asynchrone : le seul setState de `load` arrive après les awaits,
    // pas de cascade de rendus synchrone.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    void load()
  }, [load])

  return { ...state, refresh }
}
