import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ServerStatusDots } from "@/components/layout/ServerStatusDots"
import { LanguageProvider } from "@/context/LanguageContext"
import { fr } from "@/lib/translations/fr"
import type { Instance } from "@/lib/store"
import type { InstanceError } from "@/hooks/useFeed"

const inst = (id: string, name = id): Instance => ({
  id,
  name,
  url: `https://${id}.test`,
  token: "t",
})

function renderDots(instances: Instance[], instanceErrors: InstanceError[] = []) {
  const onOpen = vi.fn()
  render(
    <LanguageProvider initialLang="fr">
      <ServerStatusDots instances={instances} instanceErrors={instanceErrors} onOpen={onOpen} />
    </LanguageProvider>,
  )
  return { onOpen }
}

describe("ServerStatusDots", () => {
  it("renders nothing without instances", () => {
    const { container } = render(
      <LanguageProvider initialLang="fr">
        <ServerStatusDots instances={[]} instanceErrors={[]} onOpen={vi.fn()} />
      </LanguageProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("one dot per instance, green when healthy", () => {
    renderDots([inst("a", "Alpha"), inst("b", "Beta")])
    const dots = screen.getAllByRole("button")
    expect(dots).toHaveLength(2)
    expect(dots[0]).toHaveAttribute("aria-label", `Alpha — ${fr.serverStatus.connected}`)
    expect(dots[1]).toHaveAttribute("aria-label", `Beta — ${fr.serverStatus.connected}`)
  })

  it("marks a dead session (expired / auth) as disconnected", () => {
    renderDots(
      [inst("a", "Alpha"), inst("b", "Beta")],
      [
        { instanceId: "a", instanceName: "Alpha", reason: "expired" },
        { instanceId: "b", instanceName: "Beta", reason: "auth" },
      ],
    )
    expect(screen.getByLabelText(`Alpha — ${fr.serverStatus.disconnected}`)).toBeInTheDocument()
    expect(screen.getByLabelText(`Beta — ${fr.serverStatus.disconnected}`)).toBeInTheDocument()
  })

  it("marks an unreachable server with the unreachable label", () => {
    renderDots(
      [inst("a", "Alpha")],
      [{ instanceId: "a", instanceName: "Alpha", reason: "unreachable" }],
    )
    expect(screen.getByLabelText(`Alpha — ${fr.instances.unreachable}`)).toBeInTheDocument()
  })

  it("any click calls onOpen", () => {
    const { onOpen } = renderDots(
      [inst("a", "Alpha"), inst("b", "Beta")],
      [{ instanceId: "b", instanceName: "Beta", reason: "expired" }],
    )
    fireEvent.click(screen.getByLabelText(`Alpha — ${fr.serverStatus.connected}`))
    fireEvent.click(screen.getByLabelText(`Beta — ${fr.serverStatus.disconnected}`))
    expect(onOpen).toHaveBeenCalledTimes(2)
  })
})
