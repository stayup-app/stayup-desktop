import { describe, it, expect, vi, beforeEach } from "vitest"
import { open } from "@tauri-apps/plugin-shell"
import {
  cn,
  formatDate,
  extractIdentifier,
  stripUrlScheme,
  normalizeIdentifier,
  toRepositoryUrl,
  openUrl,
  providerDisplayName,
} from "@/lib/utils"
import type { Provider } from "@/types"

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
  it("extracts owner/repo from a changelog GitHub URL", () => {
    expect(extractIdentifier("https://github.com/facebook/react", "changelog")).toBe(
      "facebook/react",
    )
  })

  it("extracts the channel path from a YouTube URL", () => {
    expect(extractIdentifier("https://www.youtube.com/@fireship", "youtube")).toBe("@fireship")
  })

  it("extracts hostname + path from an RSS URL", () => {
    expect(extractIdentifier("https://blog.example.com/feed.xml", "rss")).toBe(
      "blog.example.com/feed.xml",
    )
  })

  it("extracts only the hostname from a scrap URL", () => {
    expect(extractIdentifier("https://news.ycombinator.com/newest", "scrap")).toBe(
      "news.ycombinator.com",
    )
  })

  it("returns the original string when the URL is invalid", () => {
    expect(extractIdentifier("not-a-url", "changelog")).toBe("not-a-url")
  })

  it("handles deeply nested changelog paths and only takes the first two segments", () => {
    expect(extractIdentifier("https://github.com/vercel/next.js/releases", "changelog")).toBe(
      "vercel/next.js",
    )
  })

  it("returns the raw URL for an unknown provider", () => {
    expect(extractIdentifier("https://example.com/x", "unknown" as Provider)).toBe(
      "https://example.com/x",
    )
  })
})

describe("normalizeIdentifier", () => {
  it("extracts owner/repo from a full GitHub URL", () => {
    expect(normalizeIdentifier("https://github.com/facebook/react", "changelog")).toBe(
      "facebook/react",
    )
  })

  it("strips a .git suffix from a GitHub URL", () => {
    expect(normalizeIdentifier("https://github.com/facebook/react.git", "changelog")).toBe(
      "facebook/react",
    )
  })

  it("strips a trailing slash from a GitHub URL", () => {
    expect(normalizeIdentifier("github.com/facebook/react/", "changelog")).toBe("facebook/react")
  })

  it("keeps an already-normalized owner/repo", () => {
    expect(normalizeIdentifier("  facebook/react  ", "changelog")).toBe("facebook/react")
  })

  it("strips scheme, .git and trailing slash when the regex does not match", () => {
    expect(normalizeIdentifier("https://github.com/single/", "changelog")).toBe("single")
  })

  it("extracts a YouTube handle from an @ URL", () => {
    expect(normalizeIdentifier("https://youtube.com/@fireship", "youtube")).toBe("fireship")
  })

  it("extracts a YouTube handle from a /channel/ URL", () => {
    expect(normalizeIdentifier("https://youtube.com/channel/UC123", "youtube")).toBe("UC123")
  })

  it("extracts a YouTube handle from a /user/ URL", () => {
    expect(normalizeIdentifier("https://youtube.com/user/someone", "youtube")).toBe("someone")
  })

  it("strips a leading @ from a bare YouTube handle", () => {
    expect(normalizeIdentifier("@fireship", "youtube")).toBe("fireship")
  })

  it("returns the trimmed value for other providers", () => {
    expect(normalizeIdentifier("  https://example.com/feed.xml  ", "rss")).toBe(
      "https://example.com/feed.xml",
    )
  })
})

describe("toRepositoryUrl", () => {
  it("builds a GitHub repository URL", () => {
    expect(toRepositoryUrl("facebook/react", "changelog")).toBe(
      "https://github.com/facebook/react/",
    )
  })

  it("builds a YouTube channel URL", () => {
    expect(toRepositoryUrl("fireship", "youtube")).toBe("https://www.youtube.com/@fireship")
  })

  it("returns the identifier unchanged for other providers", () => {
    expect(toRepositoryUrl("https://example.com/feed.xml", "rss")).toBe(
      "https://example.com/feed.xml",
    )
    expect(toRepositoryUrl("https://example.com", "scrap")).toBe("https://example.com")
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
