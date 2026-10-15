import { useEffect, useState } from "react"
import { useLanguage } from "@/context/LanguageContext"
import { readNotificationsEnabled, writeNotificationsEnabled } from "@/lib/store"

export function NotificationsToggle() {
  const { t } = useLanguage()
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    void readNotificationsEnabled().then(setEnabled)
  }, [])

  function toggle(next: boolean) {
    setEnabled(next)
    void writeNotificationsEnabled(next)
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={enabled ?? true}
        disabled={enabled === null}
        onChange={(e) => toggle(e.target.checked)}
      />
      {t.profile.notificationsToggle}
    </label>
  )
}
