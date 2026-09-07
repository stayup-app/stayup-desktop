import { useLanguage } from "@/context/LanguageContext"
import type { Instance } from "@/lib/store"
import type { InstanceError } from "@/hooks/useFeed"

type DotState = "ok" | "reconnect" | "unreachable"

const DOT_COLOR: Record<DotState, string> = {
  ok: "var(--sage)", // the theme green (--teal/--green are remapped to it)
  reconnect: "var(--rose)",
  unreachable: "var(--peach)",
}

interface ServerStatusDotsProps {
  instances: Instance[]
  /** Per-instance errors from the last fan-out (`useFeed`). */
  instanceErrors: InstanceError[]
  /** Clicking a dot: opens the server manager. For a red dot, the caller
   *  unfolds the reconnect form there. */
  onOpen: () => void
}

/** One dot per tracked server, in the header, next to the profile menu:
 *  green = reachable, red = dead session (expired/rejected token), amber =
 *  serveur injoignable. */
export function ServerStatusDots({ instances, instanceErrors, onOpen }: ServerStatusDotsProps) {
  const { t } = useLanguage()
  if (instances.length === 0) return null

  const stateOf = (id: string): DotState => {
    const err = instanceErrors.find((e) => e.instanceId === id)
    if (!err) return "ok"
    return err.reason === "unreachable" ? "unreachable" : "reconnect"
  }

  const labelOf: Record<DotState, string> = {
    ok: t.serverStatus.connected,
    reconnect: t.serverStatus.disconnected,
    unreachable: t.instances.unreachable,
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t.serverStatus.title}>
      {instances.map((inst) => {
        const s = stateOf(inst.id)
        return (
          <button
            key={inst.id}
            type="button"
            onClick={onOpen}
            title={`${inst.name} — ${labelOf[s]}`}
            aria-label={`${inst.name} — ${labelOf[s]}`}
            className="grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-[var(--surface-2)]"
          >
            <span
              className="h-[11px] w-[11px]"
              style={{ backgroundColor: DOT_COLOR[s], borderRadius: "9999px" }}
            />
          </button>
        )
      })}
    </div>
  )
}
