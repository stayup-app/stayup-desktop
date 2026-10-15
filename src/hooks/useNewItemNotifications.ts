import { useEffect, useRef, useState } from "react"
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification"
import { readLastNotifiedId, readNotificationsEnabled, writeLastNotifiedId } from "@/lib/store"
import { useReadItemsStore, getTaggedItemId } from "@/store/readItems"
import type { Translations } from "@/lib/translations"
import type { ConnectorItem } from "@/types"

/**
 * Tells the user when unread items showed up since they were last told about
 * any, with a desktop notification.
 *
 * Item ids come from a single increasing sequence, so "newer than the last one
 * notified" is just a number to remember between runs. On a first run that
 * number is only initialized, so installing the app does not announce the whole
 * backlog. The count is held back until the read state from the server has been
 * merged in: otherwise what was read on another device would be announced.
 */
export function useNewItemNotifications(
  connectors: Record<string, ConnectorItem[]> | null,
  t: Translations,
): void {
  const ready = useReadItemsStore((s) => s.ready)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const lastId = useRef<number | null | undefined>(undefined)

  useEffect(() => {
    void readNotificationsEnabled().then(setEnabled)
  }, [])

  useEffect(() => {
    if (!connectors || !ready || enabled === null) return
    const items = Object.entries(connectors).flatMap(([provider, rows]) =>
      rows.map((item) => ({ provider, item })),
    )
    if (items.length === 0) return
    const newest = Math.max(...items.map((i) => i.item.id))

    void (async () => {
      if (lastId.current === undefined) lastId.current = await readLastNotifiedId()
      const baseline = lastId.current
      if (baseline !== null && newest <= baseline) return
      lastId.current = newest
      await writeLastNotifiedId(newest)
      if (baseline === null || !enabled) return

      const { readIds } = useReadItemsStore.getState()
      const fresh = items.filter((i) => i.item.id > baseline && !readIds.has(getTaggedItemId(i)))
      if (fresh.length === 0) return

      try {
        const granted = (await isPermissionGranted()) || (await requestPermission()) === "granted"
        if (!granted) return
        sendNotification({
          title: "StayUp",
          body:
            fresh.length === 1
              ? t.profile.notifyNewOne
              : t.profile.notifyNewMany.replace("{n}", String(fresh.length)),
        })
      } catch {
        /* no notification service: nothing to tell */
      }
    })()
  }, [connectors, ready, enabled, t])
}
