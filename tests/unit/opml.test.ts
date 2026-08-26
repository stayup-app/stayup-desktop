import { describe, it, expect } from "vitest"
import { buildOpml, parseOpml } from "@/lib/opml"

describe("buildOpml", () => {
  it("serializes fluxes as OPML outlines", () => {
    const xml = buildOpml(
      [
        {
          provider: "changelog",
          url: "https://github.com/facebook/react/",
          identifier: "facebook/react",
        },
      ],
      "StayUp",
    )
    expect(xml).toContain('<opml version="2.0">')
    expect(xml).toContain("<title>StayUp</title>")
    expect(xml).toContain('category="changelog"')
    expect(xml).toContain('xmlUrl="https://github.com/facebook/react/"')
    expect(xml).toContain('text="facebook/react"')
  })

  it("escapes special characters in attribute values", () => {
    const xml = buildOpml(
      [{ provider: "rss", url: 'https://example.com/a&b?x="y"', identifier: "A & <B>" }],
      "Title & More",
    )
    expect(xml).toContain('text="A &amp; &lt;B&gt;"')
    expect(xml).toContain('xmlUrl="https://example.com/a&amp;b?x=&quot;y&quot;"')
    expect(xml).toContain("<title>Title &amp; More</title>")
  })

  it("produces a document with no outlines for an empty flux list", () => {
    const xml = buildOpml([], "StayUp")
    expect(parseOpml(xml)).toEqual([])
  })
})

describe("parseOpml", () => {
  it("round-trips what buildOpml produces", () => {
    const fluxes = [
      {
        provider: "changelog" as const,
        url: "https://github.com/facebook/react/",
        identifier: "facebook/react",
      },
      {
        provider: "youtube" as const,
        url: "https://www.youtube.com/@fireship",
        identifier: "@fireship",
      },
      {
        provider: "rss" as const,
        url: "https://blog.example.com/feed.xml",
        identifier: "blog.example.com/feed.xml",
      },
      {
        provider: "scrap" as const,
        url: "https://news.ycombinator.com",
        identifier: "news.ycombinator.com",
      },
    ]
    expect(parseOpml(buildOpml(fluxes, "StayUp"))).toEqual(fluxes)
  })

  it("keeps outlines with a provider unknown to the app (dynamic providers are valid)", () => {
    const xml = `<?xml version="1.0"?><opml version="2.0"><body>
      <outline text="a" category="podcast" xmlUrl="https://example.com/a"/>
      <outline text="b" category="rss" xmlUrl="https://example.com/b"/>
    </body></opml>`
    expect(parseOpml(xml)).toEqual([
      { provider: "podcast", url: "https://example.com/a", identifier: "a" },
      { provider: "rss", url: "https://example.com/b", identifier: "b" },
    ])
  })

  it("ignores outlines missing a category", () => {
    const xml = `<?xml version="1.0"?><opml version="2.0"><body>
      <outline text="a" xmlUrl="https://example.com/a"/>
    </body></opml>`
    expect(parseOpml(xml)).toEqual([])
  })

  it("ignores outlines missing an xmlUrl", () => {
    const xml = `<?xml version="1.0"?><opml version="2.0"><body>
      <outline text="a" category="rss"/>
    </body></opml>`
    expect(parseOpml(xml)).toEqual([])
  })

  it("falls back to the title attribute when text is absent", () => {
    const xml = `<?xml version="1.0"?><opml version="2.0"><body>
      <outline title="a" category="rss" xmlUrl="https://example.com/a"/>
    </body></opml>`
    expect(parseOpml(xml)).toEqual([
      { provider: "rss", url: "https://example.com/a", identifier: "a" },
    ])
  })

  it("returns an empty array for malformed XML", () => {
    expect(parseOpml("<opml><body><outline").length).toBe(0)
  })

  it("returns an empty array for a document with no outlines", () => {
    expect(parseOpml('<?xml version="1.0"?><opml version="2.0"><body></body></opml>')).toEqual([])
  })
})
