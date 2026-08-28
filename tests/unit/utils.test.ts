import { describe, it, expect, vi, beforeEach } from "vitest"
import { open } from "@tauri-apps/plugin-shell"
import {
  cn,
  formatDate,
  extractIdentifier,
  stripUrlScheme,
  openUrl,
  providerDisplayName,
} from "@/lib/utils"

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-2")).toBe("px-2 py-2")
  })

  it("deduplicates conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("ignores falsy values", () => {
    const condition = false
    expect(cn("px-2", condition && "py-2", null, undefined)).toBe("px-2")
  })

  it("handles conditional classes via objects", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active")
  })
})

describe("stripUrlScheme", () => {
  it("removes the https scheme", () => {
    expect(stripUrlScheme("https://example.com/feed")).toBe("example.com/feed")
  })

  it("removes the http scheme", () => {
    expect(stripUrlScheme("http://example.com")).toBe("example.com")
  })

  it("removes the www prefix along with the scheme", () => {
    expect(stripUrlScheme("https://www.example.com")).toBe("example.com")
  })

  it("removes a bare www prefix without a scheme", () => {
    expect(stripUrlScheme("www.example.com")).toBe("example.com")
  })

  it("leaves an already-bare value untouched", () => {
    expect(stripUrlScheme("facebook/react")).toBe("facebook/react")
  })
})

describe("formatDate", () => {
  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("")
  })

  it("returns empty string for undefined", () => {
    expect(formatDate(undefined)).toBe("")
  })

  it("returns empty string for an empty string", () => {
    expect(formatDate("")).toBe("")
  })

  it("formats a valid ISO date using the French locale", () => {
    const result = formatDate("2024-06-15T14:30:00Z")
    expect(result).toMatch(/2024/)
    expect(result).toMatch(/juin|15/)
  })
})

describe("extractIdentifier", () => {
  // Le libellé riche par provider vient de `display.feedLabel` (resolveFeedLabel) ;
  // extractIdentifier n'est plus qu'un repli générique : schéma et `www.` retirés.
  it("strips the scheme and www.", () => {
    expect(extractIdentifier("https://www.blog.example.com/feed.xml")).toBe(
      "blog.example.com/feed.xml",
    )
  })

  it("keeps the path otherwise", () => {
    expect(extractIdentifier("https://github.com/facebook/react")).toBe("github.com/facebook/react")
  })

  it("leaves a non-URL string untouched", () => {
    expect(extractIdentifier("not-a-url")).toBe("not-a-url")
  })
})

describe("openUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("delegates to the Tauri shell opener", async () => {
    await openUrl("https://example.com")
    expect(open).toHaveBeenCalledWith("https://example.com")
  })
})

describe("providerDisplayName", () => {
  it("capitalizes the provider name", () => {
    expect(providerDisplayName("podcast")).toBe("Podcast")
  })

  it("leaves an already capitalized name untouched", () => {
    expect(providerDisplayName("RSS")).toBe("RSS")
  })

  it("returns an empty string for an empty provider", () => {
    expect(providerDisplayName("")).toBe("")
  })
})
