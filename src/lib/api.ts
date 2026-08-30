import type { ConnectorItem, Provider, ProviderFlux } from "@/types"

export interface UserRepositoryItem {
  id: string
  repository_id: number
  created_at: string
  url: string
  provider: Provider
  config: Record<string, unknown>
}

export interface UserFeedResponse {
  repositories: UserRepositoryItem[]
  connectors: Record<string, ConnectorItem[]>
}

export interface ConnectorProvider {
  name: string
  displayName: string
  /** `auto` : l'ajout d'un flux est immédiat ; `manual` : il passe par une demande. */
  fluxApproval?: "auto" | "manual"
  /** Manifeste d'affichage brut (provider_registry.template), relayé tel quel. */
  template?: unknown
}

/** Erreur d'appel API porteuse du statut HTTP. Le message de l'API est en anglais
 *  quelle que soit la langue de l'app : c'est au point d'affichage de traduire à
 *  partir du statut, pas de montrer `StayUp API error 409: /ui/...` à l'utilisateur. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function apiFetch<T>(
  path: string,
  token: string,
  apiUrl: string,
  init?: RequestInit,
  attempt = 0,
): Promise<T> {
  const base = apiUrl.replace(/\/$/, "")
  // Un POST/DELETE peut avoir été traité avant la coupure : le rejouer créerait un
  // doublon. Seules les lectures sont réessayées.
  const isGet = !init?.method || init.method === "GET"
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    })

    if (!res.ok) {
      if (isGet && attempt === 0 && res.status >= 500) {
        return apiFetch(path, token, apiUrl, init, 1)
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      throw new ApiError(res.status, body.error ?? `StayUp API error ${res.status}: ${path}`)
    }

    return res.json() as Promise<T>
  } catch (err) {
    if (isGet && attempt === 0 && err instanceof TypeError) {
      return apiFetch(path, token, apiUrl, init, 1)
    }
    throw err
  }
}

export interface AuthConfig {
  registrationMode: "open" | "approval"
  emailPassword: boolean
  oauth: { google: boolean; github: boolean }
}

/** Ce qu'un client doit savoir avant l'écran de connexion. `null` si l'API ne
 *  répond pas ou est trop ancienne pour exposer `/auth/config` — l'appelant
 *  retombe alors sur « tout est proposé ». */
export async function fetchAuthConfig(apiUrl: string): Promise<AuthConfig | null> {
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/config`)
    if (!res.ok) return null
    return (await res.json()) as AuthConfig
  } catch {
    return null
  }
}

export async function loginWithPassword(
  email: string,
  password: string,
  apiUrl: string,
): Promise<string> {
  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) throw new ApiError(res.status, `Login failed: ${res.status}`)

  const { token } = (await res.json()) as { token: string }
  return token
}

export async function registerWithPassword(
  name: string,
  email: string,
  password: string,
  apiUrl: string,
): Promise<string> {
  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  })

  if (!res.ok) throw new ApiError(res.status, `Register failed: ${res.status}`)

  const { token } = (await res.json()) as { token: string }
  return token
}

export async function updateProfile(
  userId: string,
  token: string,
  apiUrl: string,
  data: { name?: string; email?: string; password?: string; currentPassword?: string },
): Promise<void> {
  await apiFetch(`/ui/users/${userId}`, token, apiUrl, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function getUserFeed(
  userId: string,
  token: string,
  apiUrl: string,
): Promise<UserFeedResponse> {
  return apiFetch<UserFeedResponse>(`/ui/users/${userId}/feed`, token, apiUrl)
}

export async function getConnectorProviders(
  token: string,
  apiUrl: string,
): Promise<ConnectorProvider[]> {
  const data = await apiFetch<{ providers: ConnectorProvider[] }>(
    "/connectors/providers",
    token,
    apiUrl,
  )
  return data.providers
}

/** `{ repository }` (flux créé) ou `{ status: 'pending' }` (provider `manual` :
 *  la demande part en file d'approbation admin). */
export type AddRepositoryResult =
  | { repository: UserRepositoryItem; status?: undefined }
  | { status: "pending" }

export async function addUserRepository(
  userId: string,
  token: string,
  apiUrl: string,
  data: { provider: string; url: string; config: Record<string, unknown> },
): Promise<AddRepositoryResult> {
  return apiFetch<AddRepositoryResult>(`/ui/users/${userId}/repositories`, token, apiUrl, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function deleteUserRepository(
  userId: string,
  linkId: string,
  token: string,
  apiUrl: string,
): Promise<void> {
  await apiFetch(`/ui/users/${userId}/repositories/${linkId}`, token, apiUrl, {
    method: "DELETE",
  })
}

// ─── Flux d'un provider (liste + abonnement) ────────────────────────────────────

export async function getProviderFluxes(
  provider: string,
  token: string,
  apiUrl: string,
): Promise<ProviderFlux[]> {
  const data = await apiFetch<{ fluxes: ProviderFlux[] }>(
    `/providers/${provider}/fluxes`,
    token,
    apiUrl,
  )
  return data.fluxes
}

export async function subscribeFlux(
  provider: string,
  id: number,
  token: string,
  apiUrl: string,
  dataSourceId?: number | null,
): Promise<void> {
  await apiFetch<{ success: boolean }>(
    `/providers/${provider}/fluxes/${id}/subscribe`,
    token,
    apiUrl,
    {
      method: "POST",
      ...(dataSourceId != null ? { body: JSON.stringify({ dataSourceId }) } : {}),
    },
  )
}

export async function unsubscribeFlux(
  provider: string,
  id: number,
  token: string,
  apiUrl: string,
  dataSourceId?: number | null,
): Promise<void> {
  await apiFetch<{ success: boolean }>(
    `/providers/${provider}/fluxes/${id}/subscribe`,
    token,
    apiUrl,
    {
      method: "DELETE",
      ...(dataSourceId != null ? { body: JSON.stringify({ dataSourceId }) } : {}),
    },
  )
}
