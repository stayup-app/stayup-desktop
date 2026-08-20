import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { readToken, writeToken, clearToken, readApiUrl } from "@/lib/store"
import { decodeToken, isTokenExpired } from "@/lib/session"
import { loginWithPassword, registerWithPassword } from "@/lib/api"
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
          error: err instanceof Error ? err.message : "Erreur de connexion.",
        }))
      }
    },
    [applyToken],
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
          error: err instanceof Error ? err.message : "Erreur d'inscription.",
        }))
      }
    },
    [applyToken],
  )

  const loginOAuth = useCallback(
    async (provider: "github" | "google") => {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const unlisten = await listen<string>("oauth-token", async (event) => {
          unlisten()
          await applyToken(event.payload)
        })

        await invoke("open_oauth_window", { provider })
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
