import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { readToken, writeToken, clearToken, readApiUrl } from "@/lib/store"
import { decodeToken, isTokenExpired } from "@/lib/session"
import { ApiError, loginWithPassword, registerWithPassword } from "@/lib/api"
import { useLanguage } from "@/context/LanguageContext"
import type { AppSession } from "@/lib/session"

interface AuthState {
  session: AppSession | null
  loading: boolean
  error: string | null
}

interface UseAuth extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  loginOAuth: (provider: "github" | "google") => Promise<void>
  logout: () => Promise<void>
}

export function useAuth(): UseAuth {
  const { t } = useLanguage()

  // Le message porté par une ApiError vient de l'API, en anglais : on ne le montre
  // pas, on traduit à partir du statut HTTP — seul contrat stable.
  const authErrorMessage = useCallback(
    (err: unknown, taken: string): string => {
      if (err instanceof ApiError) {
        if (err.status === 401) return t.errors.invalidCredentials
        if (err.status === 409) return taken
      }
      return t.errors.serverError
    },
    [t],
  )

  const [state, setState] = useState<AuthState>({
    session: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    ;(async () => {
      const token = await readToken()
      if (token && !isTokenExpired(token)) {
        setState({ session: decodeToken(token), loading: false, error: null })
      } else {
        if (token) await clearToken()
        setState({ session: null, loading: false, error: null })
      }
    })()
  }, [])

  const applyToken = useCallback(async (token: string) => {
    await writeToken(token)
    setState({ session: decodeToken(token), loading: false, error: null })
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const apiUrl = await readApiUrl()
        const token = await loginWithPassword(email, password, apiUrl)
        await applyToken(token)
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          error: authErrorMessage(err, t.errors.emailTaken),
        }))
      }
    },
    [applyToken, authErrorMessage, t],
  )

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const apiUrl = await readApiUrl()
        const token = await registerWithPassword(name, email, password, apiUrl)
        await applyToken(token)
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          error: authErrorMessage(err, t.errors.emailTaken),
        }))
      }
    },
    [applyToken, authErrorMessage, t],
  )

  const loginOAuth = useCallback(
    async (provider: "github" | "google") => {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const unlisten = await listen<string>("oauth-token", async (event) => {
          unlisten()
          await applyToken(event.payload)
        })

        const apiUrl = await readApiUrl()
        await invoke("open_oauth_window", { provider, apiUrl })
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : "Erreur OAuth.",
        }))
      }
    },
    [applyToken],
  )

  const logout = useCallback(async () => {
    await clearToken()
    setState({ session: null, loading: false, error: null })
  }, [])

  return { ...state, login, register, loginOAuth, logout }
}
