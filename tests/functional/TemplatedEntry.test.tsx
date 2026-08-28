/**
 * Rendu direct de `TemplatedEntry` (ligne de liste). Le parcours nominal passe
 * par `UnifiedFeedList` ; ici on cible les branches qu'il ne touche pas : une
 * entrée sans date, la vignette de repli du layout `media`, le `snippet`.
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { TemplatedEntry } from "@/components/feed/TemplatedEntry"
import type { ProviderTemplate } from "@/lib/providerTemplate"

const row: ProviderTemplate = {
  version: 1,
  list: {
    layout: "row",
    primary: "title",
    secondary: "subtitle",
    meta: "timestamp",
    snippet: "summary",
  },
  item: {
    parseContentAsJson: true,
    fields: { title: "title", subtitle: "sub", summary: "body", timestamp: "ts" },
  },
}

const media: ProviderTemplate = {
  version: 1,
  list: { layout: "media", primary: "title", thumbnail: "image" },
  item: {
    parseContentAsJson: true,
    fields: { title: "title", subtitle: "sub", image: "img", timestamp: "ts" },
  },
}

function renderEntry(template: ProviderTemplate, content: Record<string, unknown>) {
  return render(
    <TemplatedEntry
      template={template}
      item={{ content: JSON.stringify(content) }}
      color="#f4b585"
    />,
  )
}

describe("row layout", () => {
  it("shows the title, subtitle, snippet and date", () => {
    renderEntry(row, {
      title: "Hello",
      sub: "a source",
      body: "x".repeat(300),
      ts: "2024-06-15T14:30:00Z",
    })
    expect(screen.getByText("Hello")).toBeInTheDocument()
    expect(screen.getByText("a source")).toBeInTheDocument()
    // snippet is clipped to 160 chars
    expect(screen.getByText("x".repeat(160))).toBeInTheDocument()
  })

  it("renders a dash and no date when the entry has neither title nor timestamp", () => {
    renderEntry(row, { sub: "only a source" })
    expect(screen.getByText("—")).toBeInTheDocument()
    expect(screen.getByText("only a source")).toBeInTheDocument()
  })
})

describe("media layout", () => {
  it("renders the thumbnail when the entry has an image", () => {
    renderEntry(media, { title: "Clip", img: "https://img.test/t.jpg", ts: "2024-06-15T14:30:00Z" })
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://img.test/t.jpg")
  })

  it("falls back to the placeholder glyph when there is no image or date", () => {
    const { container } = renderEntry(media, { title: "Clip" })
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(container.querySelector("svg")).toBeInTheDocument()
  })
})
