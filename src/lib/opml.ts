import type { Provider } from "@/types"

export interface OpmlFlux {
  provider: Provider
  url: string
  identifier: string
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** Serializes a flux list to an OPML document (the standard XML format for feed lists). */
export function buildOpml(fluxes: OpmlFlux[], title: string): string {
  const outlines = fluxes
    .map(
      (f) =>
        `    <outline text="${escapeXml(f.identifier)}" category="${f.provider}" xmlUrl="${escapeXml(f.url)}"/>`,
    )
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>${escapeXml(title)}</title>
  </head>
  <body>
${outlines}
  </body>
</opml>
`
}

/** Parses an OPML document back into a flux list. Unknown/malformed outlines are dropped. */
export function parseOpml(xml: string): OpmlFlux[] {
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml")
  } catch {
    return []
  }
  if (doc.querySelector("parsererror")) return []

  return Array.from(doc.querySelectorAll("outline"))
    .map((el) => ({
      provider: el.getAttribute("category") ?? "",
      url: el.getAttribute("xmlUrl") ?? "",
      identifier: el.getAttribute("text") ?? el.getAttribute("title") ?? "",
    }))
    // Le provider n'a pas besoin d'être un des 4 connus de l'app : n'importe quel
    // provider déclaré côté API (voir GET /connectors/providers) est accepté ici.
    .filter((f): f is OpmlFlux => f.provider.length > 0 && f.url.length > 0)
}
