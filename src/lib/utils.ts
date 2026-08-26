import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { open } from "@tauri-apps/plugin-shell"
import type { Provider } from "@/types"

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

export function extractIdentifier(url: string, provider: Provider): string {
  try {
    const u = new URL(url)
    switch (provider) {
      case "changelog": {
        const parts = u.pathname.replace(/^\//, "").split("/")
        return parts.slice(0, 2).join("/")
      }
      case "youtube":
        return u.pathname.replace(/^\//, "")
      case "rss":
        return u.hostname + u.pathname
      case "scrap":
        return u.hostname
      default:
        return url
    }
  } catch {
    return url
  }
}

export function normalizeIdentifier(value: string, provider: Provider): string {
  const trimmed = value.trim()
  if (provider === "changelog") {
    const match = trimmed.match(/github\.com\/([^/]+\/[^/]+)/i)
    if (match) return match[1].replace(/\.git$/, "").replace(/\/$/, "")
    return trimmed
      .replace(/^https?:\/\/github\.com\//, "")
      .replace(/\.git$/, "")
      .replace(/\/$/, "")
  }
  if (provider === "youtube") {
    const match = trimmed.match(/youtube\.com\/(?:@|channel\/|user\/)([^/?\s]+)/i)
    if (match) return match[1]
    return trimmed.replace(/^@/, "")
  }
  return trimmed
}

export function toRepositoryUrl(identifier: string, provider: Provider): string {
  switch (provider) {
    case "changelog":
      return `https://github.com/${identifier}/`
    case "youtube":
      return `https://www.youtube.com/@${identifier}`
    default:
      return identifier
  }
}

export async function openUrl(url: string): Promise<void> {
  await open(url)
}

/** Libellé de repli pour un provider sans traduction connue de l'app (mêmes règles que
 *  le fallback de displayName côté API — voir stayup-api/src/db/providerRegistry.ts). */
export function providerDisplayName(provider: string): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}
