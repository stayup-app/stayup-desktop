import ReactMarkdown from "react-markdown"
import { useNavigationStore } from "@/store/navigation"
import { useLanguage } from "@/context/LanguageContext"
import { useDocContent } from "@/hooks/useDocumentation"
import { ChevronLeft, History } from "lucide-react"

interface DocViewerProps {
  docId: number
}

export function DocViewer({ docId }: DocViewerProps) {
  const { t } = useLanguage()
  const { setSelection } = useNavigationStore()
  const { doc, current, loading, error } = useDocContent(docId)

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground italic py-12 text-center">
        {t.documentation.loading}
      </p>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive py-12 text-center">{error}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => setSelection({ type: "documentation" })}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t.documentation.backToList}
        </button>
        <button
          onClick={() => setSelection({ type: "doc-history", docId })}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <History className="h-3.5 w-3.5" />
          {t.documentation.viewHistory}
        </button>
      </div>

      {doc && (
        <div className="space-y-1">
          <h2 className="font-semibold">{doc.name}</h2>
          <p className="text-xs text-muted-foreground">{doc.url}</p>
        </div>
      )}

      {current ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {t.documentation.version} {current.version} &middot; {t.documentation.scrapedAt}{" "}
            {new Date(current.scraped_at).toLocaleDateString()}
          </p>
          <div className="prose prose-sm max-w-none bg-muted/40 rounded-md p-4 overflow-x-auto [&_img]:max-w-full [&_img]:rounded [&_pre]:overflow-x-auto [&_code]:text-xs [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm">
            <ReactMarkdown>{current.content}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">{t.documentation.noContentScrapped}</p>
      )}
    </div>
  )
}
