import type { UpdateStatus } from "@/hooks/useUpdater"
import type { Translations } from "@/lib/translations"

interface UpdateBannerProps {
  status: UpdateStatus
  downloadProgress: number | null
  t: Translations
  onDismiss: () => void
}

const DISMISSIBLE: UpdateStatus[] = ["up-to-date", "error"]

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path
        d="M6.5 0L7.7 5.3L13 6.5L7.7 7.7L6.5 13L5.3 7.7L0 6.5L5.3 5.3L6.5 0Z"
        fill="var(--peach)"
      />
    </svg>
  )
}

export function UpdateBanner({ status, downloadProgress, t, onDismiss }: UpdateBannerProps) {
  if (status === "idle") return null

  function getMessage() {
    switch (status) {
      case "checking":
        return t.updater.checking
      case "up-to-date":
        return t.updater.upToDate
      case "downloading":
        if (downloadProgress !== null) {
          return t.updater.downloading + " " + String(downloadProgress) + "%"
        }
        return t.updater.downloading
      case "restarting":
        return t.updater.restarting
      case "error":
        return t.updater.error
      default:
        return ""
    }
  }

  return (
    <div
      className="flex items-center justify-between px-6 py-[9px] text-[13px]"
      style={{
        background: "linear-gradient(90deg, var(--peach-dim), var(--lavender-dim))",
        borderBottom: "1px solid var(--peach-mid)",
        color: "var(--fg-soft)",
      }}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <SparkleIcon />
        <span>{getMessage()}</span>
        {status === "downloading" && downloadProgress !== null && (
          <div
            className="flex-1 max-w-32 h-1 rounded-full overflow-hidden"
            style={{ background: "var(--surface-hi)" }}
          >
            <div
              data-testid="update-progress-bar"
              className="h-full transition-all duration-200"
              style={{ width: String(downloadProgress) + "%", background: "var(--peach)" }}
            />
          </div>
        )}
      </div>
      {DISMISSIBLE.includes(status) && (
        <button
          onClick={onDismiss}
          className="ml-4 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          &#x2715;
        </button>
      )}
    </div>
  )
}
