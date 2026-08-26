import type { ConnectorItem, Provider, ScrapRepository } from "@/types"

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
}

async function apiFetch<T>(
  path: string,
  token: string,
  apiUrl: string,
  init?: RequestInit,
  attempt = 0,
): Promise<T> {
  const base = apiUrl.replace(/\/$/, "")
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
      if (attempt === 0 && res.status >= 500) {
        return apiFetch(path, token, apiUrl, init, 1)
      }
      throw new Error(`StayUp API error ${res.status}: ${path}`)
    }

    return res.json() as Promise<T>
  } catch (err) {
    if (attempt === 0 && err instanceof TypeError) {
      return apiFetch(path, token, apiUrl, init, 1)
    }
    throw err
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

  if (res.status === 401) throw new Error("Identifiants invalides.")
  if (!res.ok) throw new Error("Erreur serveur, réessayez.")

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

  if (res.status === 409) throw new Error("Un compte existe déjà avec cet email.")
  if (!res.ok) throw new Error("Erreur serveur, réessayez.")

  const { token } = (await res.json()) as { token: string }
  return token
}

export async function updateProfile(
  userId: string,
  token: string,
  apiUrl: string,
  data: { name?: string; email?: string; password?: string },
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

export async function addUserRepository(
  userId: string,
  token: string,
  apiUrl: string,
  data: { provider: string; url: string; config: Record<string, unknown> },
): Promise<void> {
  await apiFetch(`/ui/users/${userId}/repositories`, token, apiUrl, {
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

// ─── Scrap ──────────────────────────────────────────────────────────────────────

export async function getScrapRepos(token: string, apiUrl: string): Promise<ScrapRepository[]> {
  const data = await apiFetch<{ repos: ScrapRepository[] }>("/scrap", token, apiUrl)
  return data.repos
}

export async function subscribeScrap(repoId: number, token: string, apiUrl: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/scrap/${repoId}/subscribe`, token, apiUrl, {
    method: "POST",
  })
}

export async function unsubscribeScrap(
  repoId: number,
  token: string,
  apiUrl: string,
): Promise<void> {
  await apiFetch<{ success: boolean }>(`/scrap/${repoId}/subscribe`, token, apiUrl, {
    method: "DELETE",
  })
}

export async function createScrapRequest(
  body: { url: string },
  token: string,
  apiUrl: string,
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/scrap/requests", token, apiUrl, {
    method: "POST",
    body: JSON.stringify(body),
  })
}
