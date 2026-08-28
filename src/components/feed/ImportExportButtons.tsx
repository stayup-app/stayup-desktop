import { useState } from "react"
import { save, open } from "@tauri-apps/plugin-dialog"
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs"
import { Download, Upload } from "lucide-react"
import { buildOpml, parseOpml, type OpmlFlux } from "@/lib/opml"
import { addUserRepository, getProviderFluxes, subscribeFlux } from "@/lib/api"
import { readToken, readApiUrl } from "@/lib/store"
import { useLanguage } from "@/context/LanguageContext"
import type { FeedFlux } from "@/hooks/useFeed"

interface ImportExportButtonsProps {
  fluxes: FeedFlux[]
  userId: string
  onSuccess: () => void
}

type ImportResult = { added: number; skipped: number; unavailable: number }

const OPML_FILTERS = [{ name: "OPML", extensions: ["opml", "xml"] }]

export function ImportExportButtons({ fluxes, userId, onSuccess }: ImportExportButtonsProps) {
  const { t } = useLanguage()
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    const path = await save({ defaultPath: "stayup-feeds.opml", filters: OPML_FILTERS })
    if (!path) return
    const opml = buildOpml(
      fluxes.map((f) => ({ provider: f.provider, url: f.url, identifier: f.identifier })),
      "StayUp",
    )
    await writeTextFile(path, opml)
  }

  // `scrap` (et tout provider `manual`) : on ne crée pas de flux à l'import, on
  // s'abonne à un flux déjà validé s'il en existe un pour cette URL.
  async function resolveFluxId(
    provider: string,
    url: string,
    token: string,
    apiUrl: string,
  ): Promise<number | null> {
    try {
      const fluxes = await getProviderFluxes(provider, token, apiUrl)
      return fluxes.find((f) => f.url === url)?.id ?? null
    } catch {
      return null
    }
  }

  async function importEntry(
    entry: OpmlFlux,
    token: string,
    apiUrl: string,
  ): Promise<"added" | "unavailable" | "failed"> {
    try {
      if (entry.provider === "scrap") {
        const id = await resolveFluxId("scrap", entry.url, token, apiUrl)
        if (id === null) return "unavailable"
        await subscribeFlux("scrap", id, token, apiUrl)
        return "added"
      }

      await addUserRepository(userId, token, apiUrl, {
        provider: entry.provider,
        url: entry.url,
        config: { max_scraps: 5, retention_days: 15 },
      })
      return "added"
    } catch {
      return "failed"
    }
  }

  async function handleImport() {
    setError(null)
    setResult(null)

    const path = await open({ multiple: false, filters: OPML_FILTERS })
    if (!path) return

    const text = await readTextFile(path)
    const entries = parseOpml(text)
    if (entries.length === 0) {
      setError(t.importExport.invalidFile)
      return
    }

    setImporting(true)
    const [token, apiUrl] = await Promise.all([readToken(), readApiUrl()])
    const existing = new Set(fluxes.map((f) => `${f.provider}:${f.url}`))
    let added = 0
    let skipped = 0
    let unavailable = 0

    if (token) {
      for (const entry of entries) {
        if (existing.has(`${entry.provider}:${entry.url}`)) {
          skipped++
          continue
        }
        const outcome = await importEntry(entry, token, apiUrl)
        if (outcome === "added") added++
        else if (outcome === "unavailable") unavailable++
      }
    }

    setImporting(false)
    setResult({ added, skipped, unavailable })
    if (added > 0) onSuccess()
  }

  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => void handleExport()}
          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
          style={{ border: "1px solid hsl(var(--border))" }}
          aria-label={t.importExport.export}
          title={t.importExport.export}
        >
          <Download className="h-3 w-3" />
        </button>
        <button
          onClick={() => void handleImport()}
          disabled={importing}
          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          style={{ border: "1px solid hsl(var(--border))" }}
          aria-label={t.importExport.import}
          title={t.importExport.import}
        >
          <Upload className="h-3 w-3" />
        </button>
      </div>

      {importing && (
        <p className="mt-1 px-2 text-[12px] text-muted-foreground">{t.importExport.importing}</p>
      )}
      {error && (
        <p className="mt-1 px-2 text-[12px] text-destructive">
          {error}{" "}
          <button onClick={() => setError(null)} className="underline">
            {t.importExport.close}
          </button>
        </p>
      )}
      {result && (
        <p className="mt-1 px-2 text-[12px] text-muted-foreground">
          {[
            result.added > 0 && `${result.added} ${t.importExport.added}`,
            result.skipped > 0 && `${result.skipped} ${t.importExport.alreadyPresent}`,
            result.unavailable > 0 && `${result.unavailable} ${t.importExport.unavailable}`,
          ]
            .filter(Boolean)
            .join(" · ")}{" "}
          <button onClick={() => setResult(null)} className="underline">
            {t.importExport.close}
          </button>
        </p>
      )}
    </div>
  )
}
