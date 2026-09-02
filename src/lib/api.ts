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
  /** `INSTANCE_NAME` de l'API, ou `null`. Sert de libellé par défaut d'instance. */
  name?: string | null
  registrationMode: "open" | "approval"
  emailPassword: boolean
  oauth: { google: boolean; github: boolean }
}

function isAuthConfig(v: unknown): v is AuthConfig {
  if (!v || typeof v !== "object") return false
  const c = v as Record<string, unknown>
  const o = c.oauth as Record<string, unknown> | null | undefined
  return (
    typeof c.emailPassword === "boolean" &&
    !!o &&
    typeof o === "object" &&
    typeof o.github === "boolean" &&
    typeof o.google === "boolean"
  )
}

/** Résultat d'une sonde d'URL d'API, avec la raison de l'échec pour un message
 *  clair : `unreachable` = rien ne répond ; `incompatible` = ça répond mais ce
 *  n'est pas une API StayUp (ou trop ancienne pour `/auth/config`). */
export type ApiProbe =
  | { ok: true; config: AuthConfig }
  | { ok: false; reason: "unreachable" | "incompatible" }

/** Vérifie qu'une URL pointe bien sur une API StayUp joignable : `GET /auth/config`
 *  doit répondre 2xx avec la forme attendue. */
export async function probeApiUrl(apiUrl: string): Promise<ApiProbe> {
  const base = apiUrl.replace(/\/$/, "")
  let res: Response
  try {
    res = await fetch(`${base}/auth/config`)
  } catch {
    return { ok: false, reason: "unreachable" }
  }
  if (!res.ok) return { ok: false, reason: "incompatible" }
  let body: unknown
  try {
    body = await res.json()
  } catch {
    return { ok: false, reason: "incompatible" }
  }
  return isAuthConfig(body) ? { ok: true, config: body } : { ok: false, reason: "incompatible" }
}

/** Ce qu'un client doit savoir avant l'écran de connexion. `null` si l'API ne
 *  répond pas ou est trop ancienne pour exposer `/auth/config` — l'appelant
 *  retombe alors sur « tout est proposé ». */
export async function fetchAuthConfig(apiUrl: string): Promise<AuthConfig | null> {
  const probe = await probeApiUrl(apiUrl)
  return probe.ok ? probe.config : null
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

/** `{ token }` : compte actif, connecté. `{ pending: true }` : l'instance est en
 *  `REGISTRATION_MODE=approval` — le compte attend la validation d'un admin, il
 *  n'y a pas de token et rien à stocker. */
export type RegisterOutcome = { token: string } | { pending: true }

export async function registerWithPassword(
  name: string,
  email: string,
  password: string,
  apiUrl: string,
): Promise<RegisterOutcome> {
  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  })

  if (res.status === 202) return { pending: true }
  if (!res.ok) throw new ApiError(res.status, `Register failed: ${res.status}`)

  const { token } = (await res.json()) as { token: string }
  return { token }
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
