import { load } from "@tauri-apps/plugin-store"
import type { Store } from "@tauri-apps/plugin-store"
import type { Language } from "@/lib/translations"

const STORE_FILE = "settings.json"
const AUTH_KEY = "auth_token"
const API_URL_KEY = "api_url"
const LANG_KEY = "lang"
const DEFAULT_API_URL = "https://stayup-api.r-sik.workers.dev"

let _store: Store | null = null

async function getStore(): Promise<Store> {
  if (!_store) {
    _store = await load(STORE_FILE)
  }
  return _store
}

export async function readToken(): Promise<string | null> {
  const store = await getStore()
  return (await store.get<string>(AUTH_KEY)) ?? null
}

export async function writeToken(token: string): Promise<void> {
  const store = await getStore()
  await store.set(AUTH_KEY, token)
}

export async function clearToken(): Promise<void> {
  const store = await getStore()
  await store.delete(AUTH_KEY)
}

export async function readApiUrl(): Promise<string> {
  const store = await getStore()
  return (await store.get<string>(API_URL_KEY)) ?? DEFAULT_API_URL
}

export async function writeApiUrl(url: string): Promise<void> {
  const store = await getStore()
  await store.set(API_URL_KEY, url)
}

export async function resetApiUrl(): Promise<void> {
  const store = await getStore()
  await store.delete(API_URL_KEY)
}

export async function readLang(): Promise<Language | null> {
  const store = await getStore()
  return (await store.get<Language>(LANG_KEY)) ?? null
}

export async function writeLang(lang: Language): Promise<void> {
  const store = await getStore()
  await store.set(LANG_KEY, lang)
}

const READ_ITEMS_KEY = "read_items"

export async function readReadItems(): Promise<string[]> {
  const store = await getStore()
  return (await store.get<string[]>(READ_ITEMS_KEY)) ?? []
}

export async function writeReadItems(ids: string[]): Promise<void> {
  const store = await getStore()
  await store.set(READ_ITEMS_KEY, ids)
}
