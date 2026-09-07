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
  /** `auto`: adding a flux is immediate; `manual`: it goes through a request. */
  fluxApproval?: "auto" | "manual"
  /** Raw display manifest (provider_registry.template), relayed as-is. */
  template?: unknown
}

/** API call error carrying the HTTP status. The API message is in English
 *  whatever the app's language: it is up to the display point to translate from
 *  the status, not to show `StayUp API error 409: /ui/...` to the user. */
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
  // A POST/DELETE may have been processed before the cut: replaying it would
  // create a duplicate. Only reads are retried.
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
  /** The API's `INSTANCE_NAME`, or `null`. Used as the default instance label. */
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

/** Result of an API URL probe, with the failure reason for a clear message:
 *  `unreachable` = nothing responds; `incompatible` = it responds but is not a
 *  StayUp API (or too old for `/auth/config`). */
export type ApiProbe =
  | { ok: true; config: AuthConfig }
  | { ok: false; reason: "unreachable" | "incompatible" }

/** Checks that a URL points to a reachable StayUp API: `GET /auth/config` must
 *  answer 2xx with the expected shape. */
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

/** What a client needs to know before the login screen. `null` if the API does
 *  not respond or is too old to expose `/auth/config` — the caller then falls
 *  back to "everything is offered". */
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

/** `{ token }`: account active, logged in. `{ pending: true }`: the instance is
 *  in `REGISTRATION_MODE=approval` — the account is awaiting an admin's
 *  approval, there is no token and nothing to store. */
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

/** `{ repository }` (flux created) or `{ status: 'pending' }` (`manual`
 *  provider: the request goes to the admin approval queue). */
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

// ─── A provider's fluxes (list + subscribe) ────────────────────────────────────

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
