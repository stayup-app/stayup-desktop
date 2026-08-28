/**
 * `providerIcons` — le seul pont visuel entre un connecteur et l'app : une clé
 * nommée, un tracé SVG teintable, ou une image. Les templates réels n'exercent
 * que le tracé `stroke` ; ici on couvre l'image, le tracé plein et les replis
 * d'accent / de libellé.
 */
import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { providerIcon, providerAccent, providerLabel } from "@/components/feed/providerIcons"
import type { ProviderMeta } from "@/lib/providerTemplate"

describe("providerIcon", () => {
  it("renders a named icon, falling back to the dot for an unknown key", () => {
    const { container: known } = render(<div>{providerIcon({ icon: "rss" })}</div>)
    expect(known.querySelector("svg")).toBeInTheDocument()
    const { container: unknown } = render(<div>{providerIcon({ icon: "totally-unknown" })}</div>)
    expect(unknown.querySelector("svg")).toBeInTheDocument()
  })

  it("renders an <img> for a data-URI / http icon", () => {
    const { container } = render(<div>{providerIcon({ icon: "https://cdn.test/logo.png" })}</div>)
    const img = container.querySelector("img")
    expect(img).toHaveAttribute("src", "https://cdn.test/logo.png")
  })

  it("renders a stroked SVG path set", () => {
    const { container } = render(
      <div>
        {providerIcon({ icon: { paths: ["M1 1", "M2 2"], viewBox: "0 0 8 8", stroke: true } })}
      </div>,
    )
    const paths = container.querySelectorAll("path")
    expect(paths).toHaveLength(2)
    expect(paths[0]).toHaveAttribute("stroke", "currentColor")
  })

  it("renders a filled SVG path when stroke is not set", () => {
    const { container } = render(
      <div>{providerIcon({ icon: { d: "M3 3", viewBox: "0 0 8 8" } })}</div>,
    )
    const path = container.querySelector("path")
    expect(path).toHaveAttribute("fill", "currentColor")
    expect(path).not.toHaveAttribute("stroke")
  })

  it("renders the dot when no display is given", () => {
    const { container } = render(<div>{providerIcon(undefined)}</div>)
    expect(container.querySelector("svg")).toBeInTheDocument()
  })
})

const meta = (accent?: string, name?: string): ProviderMeta => ({
  name: "x",
  displayName: "X",
  template: accent || name ? { version: 1, display: { accent, name } } : null,
})

describe("providerAccent", () => {
  it("keeps a colour-like accent, drops anything else", () => {
    expect(providerAccent(meta("#f4b585"))).toBe("#f4b585")
    expect(providerAccent(meta("var(--peach)"))).toBe("var(--peach)")
    expect(providerAccent(meta("chartreuse"))).toBe("var(--muted-foreground)")
    expect(providerAccent(meta())).toBe("var(--muted-foreground)")
    expect(providerAccent(undefined)).toBe("var(--muted-foreground)")
  })
})

describe("providerLabel", () => {
  it("prefers the template name, then the API displayName, then the capitalised fallback", () => {
    expect(providerLabel(meta(undefined, "Nice Name"), "raw")).toBe("Nice Name")
    expect(providerLabel({ name: "x", displayName: "Api Name", template: null }, "raw")).toBe(
      "Api Name",
    )
    expect(providerLabel(undefined, "changelog")).toBe("Changelog")
  })
})
