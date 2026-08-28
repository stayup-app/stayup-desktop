import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { open } from "@tauri-apps/plugin-shell"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function stripUrlScheme(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/^www\./, "")
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return ""
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date))
}

/** Libellé court d'un flux : le schéma retiré. Le libellé riche par provider
 *  vient de `display.feedLabel` du template (voir resolveFeedLabel). */
export function extractIdentifier(url: string): string {
  return stripUrlScheme(url)
}

export async function openUrl(url: string): Promise<void> {
  await open(url)
}

/** Libellé de repli pour un provider sans traduction connue de l'app (mêmes règles que
 *  le fallback de displayName côté API — voir stayup-api/src/db/providerRegistry.ts). */
export function providerDisplayName(provider: string): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}
