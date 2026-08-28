import type { ReactNode } from "react"
import type { ProviderMeta, ProviderTemplate } from "@/lib/providerTemplate"
import { resolveIcon } from "@/lib/providerTemplate"

/**
 * Jeu d'icônes nommées : un template déclare `display.icon` = une de ces clés
 * (un nom inconnu, ou aucun template, retombe sur `dot`). C'est le seul lien
 * entre un connecteur et l'app côté visuel — jamais de SVG venu de la base.
 */
const ICONS: Record<string, ReactNode> = {
  changelog: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1L9.5 4H11.5L7 1ZM7 1L4.5 4H2.5L7 1Z" fill="currentColor" opacity="0.8" />
      <rect x="2" y="4" width="10" height="1" rx="0.5" fill="currentColor" />
      <rect x="3" y="6.5" width="8" height="1" rx="0.5" fill="currentColor" opacity="0.5" />
      <rect x="3" y="8.5" width="6" height="1" rx="0.5" fill="currentColor" opacity="0.5" />
    </svg>
  ),
  video: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="12" height="8" rx="2" fill="currentColor" />
      <path d="M5.5 5.5L9 7L5.5 8.5V5.5Z" fill="white" />
    </svg>
  ),
  rss: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="3" cy="11" r="1.5" fill="currentColor" />
      <path
        d="M2 7.5C5 7.5 6.5 9 6.5 11.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M2 4C7 4 10 7 10 12"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  ),
  globe: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <ellipse cx="7" cy="7" rx="2" ry="5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  table: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1.5" y="2" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="1.5" y1="5.5" x2="12.5" y2="5.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="5.5" y1="5.5" x2="5.5" y2="12" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  book: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 2.5h4.5A1.5 1.5 0 0 1 8 4v8a1.2 1.2 0 0 0-1.2-1.2H2V2.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
      />
      <path
        d="M12 2.5H7.5A1.5 1.5 0 0 0 6 4v8a1.2 1.2 0 0 1 1.2-1.2H12V2.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
      />
    </svg>
  ),
  dot: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  ),
}

export function providerIcon(display: ProviderTemplate["display"] | undefined): ReactNode {
  const spec = resolveIcon(display)
  if (spec.kind === "named") return ICONS[spec.name] ?? ICONS.dot
  if (spec.kind === "image") {
    return <img src={spec.src} alt="" width={14} height={14} style={{ objectFit: "contain" }} />
  }
  return (
    <svg width="14" height="14" viewBox={spec.viewBox} fill="none" aria-hidden="true">
      {spec.paths.map((d, i) =>
        spec.stroke ? (
          <path
            key={i}
            d={d}
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path key={i} d={d} fill="currentColor" />
        ),
      )}
    </svg>
  )
}

const GENERIC_ACCENT = "var(--muted-foreground)"

/** Couleur d'accent d'un provider : celle de son template, sinon neutre. */
export function providerAccent(meta: ProviderMeta | undefined): string {
  const accent = meta?.template?.display?.accent
  return accent && /^#|^var\(|^hsl|^rgb/.test(accent) ? accent : GENERIC_ACCENT
}

/** Libellé d'un provider : `display.name` du template, sinon le displayName API,
 *  sinon le nom capitalisé (même repli que stayup-api). */
export function providerLabel(meta: ProviderMeta | undefined, fallback: string): string {
  return (
    meta?.template?.display?.name ||
    meta?.displayName ||
    fallback.charAt(0).toUpperCase() + fallback.slice(1)
  )
}
