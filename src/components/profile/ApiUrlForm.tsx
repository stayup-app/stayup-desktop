import { useEffect, useState } from "react"
import { readApiUrl, resetApiUrl, writeApiUrl } from "@/lib/store"
import { useLanguage } from "@/context/LanguageContext"

export function ApiUrlForm({ onChanged }: { onChanged?: () => void } = {}) {
  const { t } = useLanguage()
  const [value, setValue] = useState("")
  const [pending, setPending] = useState<"save" | "reset" | null>(null)
  const [error, setError] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    readApiUrl().then(setValue)
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(false)
    setSuccess(false)
    const trimmed = value.trim().replace(/\/$/, "")
    try {
      new URL(trimmed)
    } catch {
      setError(true)
      return
    }
    setPending("save")
    await writeApiUrl(trimmed)
    setValue(trimmed)
    setPending(null)
    setSuccess(true)
    onChanged?.()
  }

  async function handleReset() {
    setPending("reset")
    setError(false)
    setSuccess(false)
    await resetApiUrl()
    setValue(await readApiUrl())
    setPending(null)
    onChanged?.()
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="profile-api-url" className="text-sm font-medium">
          {t.profile.apiUrl}
        </label>
        <input
          id="profile-api-url"
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {error && <p className="text-xs text-destructive">{t.profile.apiUrlInvalid}</p>}
      </div>

      {success && (
        <p className="text-xs" style={{ color: "var(--sage)" }}>
          {t.profile.apiUrlSaved}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending !== null}
          className="h-9 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {pending === "save" ? t.profile.apiUrlSaving : t.profile.apiUrlSave}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={pending !== null}
          className="h-9 self-start rounded-md border border-border px-4 text-sm font-medium hover:bg-surface-hi transition-colors disabled:pointer-events-none disabled:opacity-50"
        >
          {pending === "reset" ? t.profile.apiUrlResetting : t.profile.apiUrlReset}
        </button>
      </div>
    </form>
  )
}
