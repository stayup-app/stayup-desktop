import { load } from "@tauri-apps/plugin-store"
import type { Store } from "@tauri-apps/plugin-store"
import type { Language } from "@/lib/translations"

const STORE_FILE = "settings.json"
// Legacy keys (single-API): still read once to migrate to `instances`.
const AUTH_KEY = "auth_token"
const API_URL_KEY = "api_url"
const INSTANCES_KEY = "instances"
const LANG_KEY = "lang"
export const DEFAULT_API_URL = "https://stayup-api.r-sik.workers.dev"

/** A session on an API instance. `instances[0]` is the primary: the default
 *  target for a new flux, not removable without a full logout. */
export interface Instance {
  id: string
  url: string
  name: string
  token: string
}

let _store: Store | null = null

async function getStore(): Promise<Store> {
  if (!_store) {
    _store = await load(STORE_FILE)
  }
  return _store
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function newId(): string {
  return crypto.randomUUID()
}

// ─── Instances ────────────────────────────────────────────────────────────────

export async function readInstances(): Promise<Instance[]> {
  const store = await getStore()
  const stored = (await store.get<Instance[]>(INSTANCES_KEY)) ?? null
  if (stored && stored.length > 0) return stored

  // single-API → list migration: we rebuild a primary instance from the old
  // keys, then erase them.
  const legacyToken = (await store.get<string>(AUTH_KEY)) ?? null
  if (!legacyToken) return []
  const legacyUrl = (await store.get<string>(API_URL_KEY)) ?? DEFAULT_API_URL
  const migrated: Instance[] = [
    { id: newId(), url: legacyUrl, name: hostOf(legacyUrl), token: legacyToken },
  ]
  await store.set(INSTANCES_KEY, migrated)
  await store.delete(AUTH_KEY)
  await store.delete(API_URL_KEY)
  return migrated
}

export async function writeInstances(list: Instance[]): Promise<void> {
  const store = await getStore()
  await store.set(INSTANCES_KEY, list)
}

/** Creates or replaces the primary (same id kept if it exists). Used by the
 *  login flow as long as there is only one instance. */
export async function upsertPrimaryInstance(input: {
  url: string
  token: string
  name?: string
}): Promise<Instance> {
  const list = await readInstances()
  const existing = list[0]
  const primary: Instance = {
    id: existing?.id ?? newId(),
    url: input.url,
    name: input.name ?? existing?.name ?? hostOf(input.url),
    token: input.token,
  }
  await writeInstances([primary, ...list.slice(1)])
  return primary
}

export async function addInstance(input: {
  url: string
  token: string
  name: string
}): Promise<Instance> {
  const list = await readInstances()
  const inst: Instance = { id: newId(), ...input }
  await writeInstances([...list, inst])
  return inst
}

export async function removeInstance(id: string): Promise<Instance[]> {
  const list = await readInstances()
  const next = list.filter((i) => i.id !== id)
  await writeInstances(next)
  return next
}

export async function renameInstance(id: string, name: string): Promise<void> {
  const list = await readInstances()
  await writeInstances(list.map((i) => (i.id === id ? { ...i, name } : i)))
}

export async function setPrimaryInstance(id: string): Promise<void> {
  const list = await readInstances()
  const target = list.find((i) => i.id === id)
  if (!target) return
  await writeInstances([target, ...list.filter((i) => i.id !== id)])
}

export async function updateInstanceToken(id: string, token: string): Promise<void> {
  const list = await readInstances()
  await writeInstances(list.map((i) => (i.id === id ? { ...i, token } : i)))
}

export async function clearInstances(): Promise<void> {
  const store = await getStore()
  await store.delete(INSTANCES_KEY)
}

// ─── single-API compat: reads/writes the primary ────────────────────────────
// These helpers stay until the feed, the sidebar and the profile move to
// multi-instance; they operate on `instances[0]`.

export async function readToken(): Promise<string | null> {
  return (await readInstances())[0]?.token ?? null
}

export async function writeToken(token: string): Promise<void> {
  const url = (await readInstances())[0]?.url ?? DEFAULT_API_URL
  await upsertPrimaryInstance({ url, token })
}

export async function clearToken(): Promise<void> {
  await clearInstances()
}

export async function readApiUrl(): Promise<string> {
  return (await readInstances())[0]?.url ?? DEFAULT_API_URL
}

export async function writeApiUrl(url: string): Promise<void> {
  const list = await readInstances()
  if (list.length === 0) {
    await writeInstances([{ id: newId(), url, name: hostOf(url), token: "" }])
    return
  }
  await writeInstances([{ ...list[0], url }, ...list.slice(1)])
}

export async function resetApiUrl(): Promise<void> {
  await writeApiUrl(DEFAULT_API_URL)
}

// ─── Langue ──────────────────────────────────────────────────────────────────

export async function readLang(): Promise<Language | null> {
  const store = await getStore()
  return (await store.get<Language>(LANG_KEY)) ?? null
}

export async function writeLang(lang: Language): Promise<void> {
  const store = await getStore()
  await store.set(LANG_KEY, lang)
}

// ─── Items lus ───────────────────────────────────────────────────────────────

const READ_ITEMS_KEY = "read_items"

export async function readReadItems(): Promise<string[]> {
  const store = await getStore()
  return (await store.get<string[]>(READ_ITEMS_KEY)) ?? []
}

export async function writeReadItems(ids: string[]): Promise<void> {
  const store = await getStore()
  await store.set(READ_ITEMS_KEY, ids)
}
