import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import {
  type Instance,
  readInstances,
  upsertPrimaryInstance,
  addInstance as storeAddInstance,
  removeInstance as storeRemoveInstance,
  renameInstance as storeRenameInstance,
  setPrimaryInstance as storeSetPrimary,
  updateInstanceToken,
  clearInstances,
  readApiUrl,
  hostOf,
} from "@/lib/store"
import { decodeToken, isTokenExpired } from "@/lib/session"
import { ApiError, fetchAuthConfig, loginWithPassword, registerWithPassword } from "@/lib/api"
import { useLanguage } from "@/context/LanguageContext"
import type { AppSession } from "@/lib/session"

/** Une session, rattachée à son instance. `session` (compat) = la primaire. */
export interface InstanceSession extends AppSession {
  instanceId: string
  instanceName: string
  instanceUrl: string
  expired: boolean
}

/** Comment authentifier une instance qu'on ajoute (ou reconnecte) : se connecter
 *  à un compte existant. Créer un compte sur l'instance passe par
 *  `registerInstance`, pas par `AuthMethod`. */
export type AuthMethod =
  | { kind: "password"; email: string; password: string }
  | { kind: "oauth"; provider: "github" | "google" }

/** Résultat d'une création de compte sur une instance : `{}` = compte actif et
 *  instance ajoutée ; `{ pending: true }` = instance en mode `approval`, compte
 *  en attente de validation admin (rien n'est ajouté) ; `{ error }` sinon. */
export type RegisterInstanceResult = { pending?: boolean; error?: string }

interface UseAuth {
  session: InstanceSession | null
  sessions: InstanceSession[]
  instances: Instance[]
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  loginOAuth: (provider: "github" | "google") => Promise<void>
  logout: () => Promise<void>
  addInstance: (url: string, method: AuthMethod) => Promise<string | null>
  registerInstance: (
    url: string,
    creds: { name: string; email: string; password: string },
  ) => Promise<RegisterInstanceResult>
  reconnectInstance: (id: string, method: AuthMethod) => Promise<string | null>
  removeInstance: (id: string) => Promise<void>
  renameInstance: (id: string, name: string) => Promise<void>
  setPrimary: (id: string) => Promise<void>
}

function toSession(inst: Instance): InstanceSession {
  return {
    ...decodeToken(inst.token),
    instanceId: inst.id,
    instanceName: inst.name,
    instanceUrl: inst.url,
    expired: isTokenExpired(inst.token),
  }
}

/** Récupère un token pour `url` selon la méthode choisie. Pour OAuth desktop,
 *  la fenêtre système émet `oauth-token` : le closure capture déjà l'instance
 *  visée, donc pas besoin de router par `state`. */
async function tokenFor(url: string, method: AuthMethod): Promise<string> {
  if (method.kind === "password") {
    return loginWithPassword(method.email, method.password, url)
  }
  const { provider } = method
  let unlisten: (() => void) | undefined
  try {
    return await new Promise<string>((resolve, reject) => {
      listen<string>("oauth-token", (event) => resolve(event.payload)).then((un) => {
        unlisten = un
      }, reject)
      invoke("open_oauth_window", { provider, apiUrl: url }).catch(reject)
    })
  } finally {
    unlisten?.()
  }
}

export function useAuth(): UseAuth {
  const { t } = useLanguage()

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

  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setInstances(await readInstances())
  }, [])

  useEffect(() => {
    ;(async () => {
      await reload()
      setLoading(false)
    })()
  }, [reload])

  const sessions = instances.filter((i) => i.token).map(toSession)
  const session = sessions[0] ?? null

  const primaryLogin = useCallback(
    async (run: () => Promise<string>) => {
      setLoading(true)
      setError(null)
      try {
        const url = await readApiUrl()
        const token = await run()
        await upsertPrimaryInstance({ url, token })
        await reload()
      } catch (err) {
        setError(authErrorMessage(err, t.errors.emailTaken))
      } finally {
        setLoading(false)
      }
    },
    [authErrorMessage, reload, t],
  )

  const login = useCallback(
    (email: string, password: string) =>
      primaryLogin(async () => loginWithPassword(email, password, await readApiUrl())),
    [primaryLogin],
  )

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setLoading(true)
      setError(null)
      try {
        const url = await readApiUrl()
        const outcome = await registerWithPassword(name, email, password, url)
        if ("pending" in outcome) {
          setError(t.auth.accountPending)
          return
        }
        await upsertPrimaryInstance({ url, token: outcome.token })
        await reload()
      } catch (err) {
        setError(authErrorMessage(err, t.errors.emailTaken))
      } finally {
        setLoading(false)
      }
    },
    [authErrorMessage, reload, t],
  )

  const loginOAuth = useCallback(
    (provider: "github" | "google") =>
      primaryLogin(async () => tokenFor(await readApiUrl(), { kind: "oauth", provider })),
    [primaryLogin],
  )

  const logout = useCallback(async () => {
    await clearInstances()
    await reload()
  }, [reload])

  /** Nom d'affichage : `INSTANCE_NAME` s'il existe, sinon l'hôte de l'URL. */
  const resolveName = useCallback(async (url: string): Promise<string> => {
    const config = await fetchAuthConfig(url).catch(() => null)
    return config?.name?.trim() || hostOf(url)
  }, [])

  const addInstance = useCallback(
    async (url: string, method: AuthMethod): Promise<string | null> => {
      try {
        const token = await tokenFor(url, method)
        await storeAddInstance({ url, name: await resolveName(url), token })
        await reload()
        return null
      } catch (err) {
        return authErrorMessage(err, t.errors.emailTaken)
      }
    },
    [authErrorMessage, reload, resolveName, t],
  )

  const registerInstance = useCallback(
    async (
      url: string,
      creds: { name: string; email: string; password: string },
    ): Promise<RegisterInstanceResult> => {
      try {
        const outcome = await registerWithPassword(creds.name, creds.email, creds.password, url)
        if ("pending" in outcome) return { pending: true }
        await storeAddInstance({ url, name: await resolveName(url), token: outcome.token })
        await reload()
        return {}
      } catch (err) {
        return { error: authErrorMessage(err, t.errors.emailTaken) }
      }
    },
    [authErrorMessage, reload, resolveName, t],
  )

  const reconnectInstance = useCallback(
    async (id: string, method: AuthMethod): Promise<string | null> => {
      const target = instances.find((i) => i.id === id)
      if (!target) return t.errors.serverError
      try {
        const token = await tokenFor(target.url, method)
        await updateInstanceToken(id, token)
        await reload()
        return null
      } catch (err) {
        return authErrorMessage(err, t.errors.emailTaken)
      }
    },
    [authErrorMessage, instances, reload, t],
  )

  const removeInstance = useCallback(
    async (id: string) => {
      // Retirer la primaire = déconnexion complète.
      if (instances[0]?.id === id) {
        await clearInstances()
      } else {
        await storeRemoveInstance(id)
      }
      await reload()
    },
    [instances, reload],
  )

  const renameInstance = useCallback(
    async (id: string, name: string) => {
      await storeRenameInstance(id, name)
      await reload()
    },
    [reload],
  )

  const setPrimary = useCallback(
    async (id: string) => {
      await storeSetPrimary(id)
      await reload()
    },
    [reload],
  )

  return {
    session,
    sessions,
    instances,
    loading,
    error,
    login,
    register,
    loginOAuth,
    logout,
    addInstance,
    registerInstance,
    reconnectInstance,
    removeInstance,
    renameInstance,
    setPrimary,
  }
}
