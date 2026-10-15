import { load } from "@tauri-apps/plugin-store"
import type { Store } from "@tauri-apps/plugin-store"
import type { Language } from "@/lib/translations"

const STORE_FILE = "settings.json"
const AUTH_KEY = "auth_token"
// Keys of versions that supported several servers.
const LEGACY_INSTANCES_KEY = "instances"
const LEGACY_API_URL_KEY = "api_url"
const LANG_KEY = "lang"

let _store: Store | null = null

async function getStore(): Promise<Store> {
  if (!_store) {
    _store = await load(STORE_FILE)
  }
  return _store
}

// ─── Session ──────────────────────────────────────────────────────────────────

export async function readToken(): Promise<string | null> {
  const store = await getStore()
  const token = (await store.get<string>(AUTH_KEY)) ?? null
  if (token) return token

  // Versions that supported several servers kept a list: carry the first
  // session over, then drop the obsolete keys.
  const legacy = (await store.get<{ token?: string }[]>(LEGACY_INSTANCES_KEY)) ?? null
  const migrated = legacy?.[0]?.token ?? null
  if (legacy) {
    if (migrated) await store.set(AUTH_KEY, migrated)
    await store.delete(LEGACY_INSTANCES_KEY)
    await store.delete(LEGACY_API_URL_KEY)
  }
  return migrated
}

export async function writeToken(token: string): Promise<void> {
  const store = await getStore()
  await store.set(AUTH_KEY, token)
}

export async function clearToken(): Promise<void> {
  const store = await getStore()
  await store.delete(AUTH_KEY)
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
