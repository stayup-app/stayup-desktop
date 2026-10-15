import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { readToken, writeToken, clearToken } from "@/lib/store"
import { API_URL } from "@/lib/config"
import { decodeToken, isTokenExpired } from "@/lib/session"
import { ApiError, loginWithPassword, registerWithPassword } from "@/lib/api"
import { useLanguage } from "@/context/LanguageContext"
import type { AppSession } from "@/lib/session"

interface UseAuth {
  /** The signed-in user, or null (signed out, or the stored token has expired). */
  session: AppSession | null
  token: string | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  loginOAuth: (provider: "github" | "google") => Promise<void>
  logout: () => Promise<void>
}

/** Desktop OAuth: the system window emits `oauth-token` once the user is back. */
async function oauthToken(provider: "github" | "google"): Promise<string> {
  let unlisten: (() => void) | undefined
  try {
    return await new Promise<string>((resolve, reject) => {
      listen<string>("oauth-token", (event) => resolve(event.payload)).then((un) => {
        unlisten = un
      }, reject)
      invoke("open_oauth_window", { provider, apiUrl: API_URL }).catch(reject)
    })
  } finally {
    unlisten?.()
  }
}

export function useAuth(): UseAuth {
  const { t } = useLanguage()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const stored = await readToken()
      setToken(stored && !isTokenExpired(stored) ? stored : null)
      setLoading(false)
    })()
  }, [])

  const authErrorMessage = useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError) {
        if (err.status === 401) return t.errors.invalidCredentials
        if (err.status === 409) return t.errors.emailTaken
      }
      return t.errors.serverError
    },
    [t],
  )

  const signIn = useCallback(
    async (run: () => Promise<string>) => {
      setLoading(true)
      setError(null)
      try {
        const next = await run()
        await writeToken(next)
        setToken(next)
      } catch (err) {
        setError(authErrorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [authErrorMessage],
  )

  const login = useCallback(
    (email: string, password: string) => signIn(() => loginWithPassword(email, password)),
    [signIn],
  )

  const register = useCallback(
    (name: string, email: string, password: string) =>
      signIn(() => registerWithPassword(name, email, password)),
    [signIn],
  )

  const loginOAuth = useCallback(
    (provider: "github" | "google") => signIn(() => oauthToken(provider)),
    [signIn],
  )

  const logout = useCallback(async () => {
    await clearToken()
    setToken(null)
  }, [])

  const session = token ? decodeToken(token) : null

  return { session, token, loading, error, login, register, loginOAuth, logout }
}
