import { useLanguage } from "@/context/LanguageContext"
import type { Language } from "@/lib/translations"

const LANGUAGE_LABELS: Record<Language, string> = {
  en: "🇬🇧 English",
  fr: "🇫🇷 Français",
  de: "🇩🇪 Deutsch",
  es: "🇪🇸 Español",
  it: "🇮🇹 Italiano",
  pt: "🇵🇹 Português",
  ja: "🇯🇵 日本語",
  zh: "🇨🇳 中文",
}

export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage()

  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as Language)}
      aria-label="Language"
      className="text-sm bg-transparent text-muted-foreground hover:text-foreground rounded px-1 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      style={{ border: "1px solid transparent" }}
    >
      {(Object.keys(LANGUAGE_LABELS) as Language[]).map((code) => (
        <option key={code} value={code} className="bg-background text-foreground">
          {LANGUAGE_LABELS[code]}
        </option>
      ))}
    </select>
  )
}
