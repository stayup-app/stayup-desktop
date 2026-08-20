import { createContext, useContext, useState, useEffect } from "react"
import {
  en,
  fr,
  de,
  es,
  it,
  pt,
  ja,
  zh,
  type Translations,
  type Language,
} from "@/lib/translations"
import { readLang, writeLang } from "@/lib/store"

const dictionaries: Record<Language, Translations> = { en, fr, de, es, it, pt, ja, zh }

interface LanguageContextType {
  lang: Language
  t: Translations
  setLang: (l: Language) => void
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({
  children,
  initialLang = "en",
}: {
  children: React.ReactNode
  initialLang?: Language
}) {
  const [lang, setLangState] = useState<Language>(initialLang)

  useEffect(() => {
    readLang().then((stored) => {
      if (stored) setLangState(stored)
    })
  }, [])

  const setLang = (newLang: Language) => {
    setLangState(newLang)
    writeLang(newLang)
  }

  return (
    <LanguageContext.Provider value={{ lang, t: dictionaries[lang], setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider")
  return ctx
}
