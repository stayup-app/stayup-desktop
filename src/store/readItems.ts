import { create } from "zustand"
import { readReadItems, writeReadItems } from "@/lib/store"
import type { TaggedItem } from "@/types"

/** Key for a read item: `<instanceId>:<provider>:<id>`. A connector id
 *  (SERIAL) is only unique within an instance, hence the prefix. */
export function getTaggedItemId(tagged: TaggedItem): string {
  const inst = typeof tagged.item._instance_id === "string" ? tagged.item._instance_id : ""
  return `${inst}:${tagged.provider}:${tagged.item.id}`
}

/** Migration: pre-multi-instance keys are `<provider>:<id>` (2 segments) — we
 *  attach them to the primary instance. */
function migrateIds(stored: string[], primaryId: string | undefined): string[] {
  if (!primaryId) return stored
  return stored.map((id) => (id.split(":").length === 2 ? `${primaryId}:${id}` : id))
}

interface ReadItemsState {
  readIds: Set<string>
  initialized: boolean
  init: (primaryInstanceId?: string) => Promise<void>
  markRead: (tagged: TaggedItem) => Promise<void>
  markAllRead: (items: TaggedItem[]) => Promise<void>
  cleanup: (currentIds: Set<string>) => Promise<void>
}

export const useReadItemsStore = create<ReadItemsState>()((set, get) => ({
  readIds: new Set(),
  initialized: false,

  init: async (primaryInstanceId?: string) => {
    if (get().initialized) return
    const stored = migrateIds(await readReadItems(), primaryInstanceId)
    set({ readIds: new Set(stored), initialized: true })
  },

  markRead: async (tagged: TaggedItem) => {
    const id = getTaggedItemId(tagged)
    const { readIds } = get()
    if (readIds.has(id)) return
    const next = new Set(readIds)
    next.add(id)
    set({ readIds: next })
    await writeReadItems([...next])
  },

  markAllRead: async (items: TaggedItem[]) => {
    const { readIds } = get()
    const next = new Set(readIds)
    for (const tagged of items) next.add(getTaggedItemId(tagged))
    if (next.size === readIds.size) return
    set({ readIds: next })
    await writeReadItems([...next])
  },

  cleanup: async (currentIds: Set<string>) => {
    const { readIds } = get()
    const filtered = [...readIds].filter((id) => currentIds.has(id))
    if (filtered.length === readIds.size) return
    const next = new Set(filtered)
    set({ readIds: next })
    await writeReadItems(filtered)
  },
}))
