import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { open } from "@tauri-apps/plugin-shell"
import { FeedContentViewer } from "@/components/feed/FeedContentViewer"
import { LanguageProvider } from "@/context/LanguageContext"
import { fr } from "@/lib/translations/fr"
import type { TaggedItem } from "@/types"

const LS_FONT_KEY = "STAYUP_FONT_SIZE_OFFSET"

const repositories = [{ repository_id: 1, url: "https://github.com/facebook/react" }]

const changelogItem: TaggedItem = {
  provider: "changelog",
  item: {
    id: 1,
    repository_id: 1,
    content: "## Title\n**bold** and `code`",
    datetime: "2024-06-15T14:30:00Z",
    executed_at: "2024-06-15T15:00:00Z",
    success: true,
    version: "v19.0.0",
  },
}

const youtubeItem: TaggedItem = {
  provider: "youtube",
  item: {
    id: 2,
    repository_id: 2,
    version: "abc123",
    content: JSON.stringify({
      title: "Ten React tricks",
      thumbnail: "https://img.example.com/t.jpg",
      url: "https://www.youtube.com/@fireship",
      link: "https://youtu.be/abc123",
    }),
    datetime: "2024-06-14T10:00:00Z",
    executed_at: "2024-06-14T10:05:00Z",
    success: true,
  },
}

const rssItem: TaggedItem = {
  provider: "rss",
  item: {
    id: 3,
    repository_id: 3,
    content: JSON.stringify({
      version: "e1",
      title: "A blog post",
      link: "https://www.blog.example.com/post",
      summary: "<p>Hello <strong>world</strong></p>",
    }),
    datetime: "2024-06-13T09:00:00Z",
    executed_at: "2024-06-13T09:01:00Z",
    success: true,
  },
}

const scrapItem: TaggedItem = {
  provider: "scrap",
  item: {
    id: 4,
    repository_id: 4,
    content: "Scraped body text",
    params: { url: "https://news.example.com", articles_selector: "a", content_selector: "p" },
    executed_at: "2024-06-12T08:00:00Z",
    success: true,
  },
}

const genericItem: TaggedItem = {
  provider: "podcast",
  item: {
    id: 5,
    repository_id: 5,
    content: "Un épisode sur les flux RSS",
    version: "s02e04",
    datetime: "2024-06-11T07:00:00Z",
    executed_at: "2024-06-11T07:30:00Z",
  },
}

function renderViewer(item: TaggedItem | null, repos = repositories) {
  return render(
    <LanguageProvider initialLang="fr">
      <FeedContentViewer item={item} repositories={repos} />
    </LanguageProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe("empty state", () => {
  it("prompts to pick an item when nothing is selected", () => {
    renderViewer(null)
    expect(screen.getByText(fr.viewer.selectItem)).toBeInTheDocument()
  })
})

describe("font size controls", () => {
  it("grows the font and persists the offset", () => {
    renderViewer(scrapItem)

    fireEvent.click(screen.getByLabelText("Agrandir la police"))

    expect(localStorage.getItem(LS_FONT_KEY)).toBe("1")
    expect(screen.getByText("Scraped body text")).toHaveStyle({ fontSize: "16px" })
  })

  it("shrinks the font and persists the offset", () => {
    renderViewer(scrapItem)

    fireEvent.click(screen.getByLabelText("Réduire la police"))

    expect(localStorage.getItem(LS_FONT_KEY)).toBe("-1")
    expect(screen.getByText("Scraped body text")).toHaveStyle({ fontSize: "14px" })
  })

  it("restores a persisted offset on mount", () => {
    localStorage.setItem(LS_FONT_KEY, "3")
    renderViewer(scrapItem)
    expect(screen.getByText("Scraped body text")).toHaveStyle({ fontSize: "18px" })
  })

  it("treats an unparsable stored offset as zero", () => {
    localStorage.setItem(LS_FONT_KEY, "not-a-number")
    renderViewer(scrapItem)
    expect(screen.getByText("Scraped body text")).toHaveStyle({ fontSize: "15px" })
  })

  it("clamps at the maximum offset", () => {
    localStorage.setItem(LS_FONT_KEY, "10")
    renderViewer(scrapItem)

    const grow = screen.getByLabelText("Agrandir la police")
    expect(grow).toBeDisabled()
    expect(screen.getByLabelText("Réduire la police")).not.toBeDisabled()
  })

  it("clamps at the minimum offset", () => {
    localStorage.setItem(LS_FONT_KEY, "-4")
    renderViewer(scrapItem)

    expect(screen.getByLabelText("Réduire la police")).toBeDisabled()
    expect(screen.getByLabelText("Agrandir la police")).not.toBeDisabled()
  })

  it("falls back to zero when localStorage is unreadable", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem")
    getItem.mockImplementation(() => {
      throw new Error("denied")
    })
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied")
    })

    renderViewer(scrapItem)
    expect(screen.getByText("Scraped body text")).toHaveStyle({ fontSize: "15px" })

    fireEvent.click(screen.getByLabelText("Agrandir la police"))
    expect(screen.getByText("Scraped body text")).toHaveStyle({ fontSize: "16px" })

    getItem.mockRestore()
    setItem.mockRestore()
  })
})

describe("changelog content", () => {
  it("shows the repo name, version and markdown-stripped body", () => {
    renderViewer(changelogItem)
    expect(screen.getByText("facebook/react")).toBeInTheDocument()
    expect(screen.getByText("v19.0.0")).toBeInTheDocument()
    expect(screen.getByText("Title bold and code")).toBeInTheDocument()
  })

  it("opens the release page on GitHub", () => {
    renderViewer(changelogItem)
    fireEvent.click(screen.getByText(fr.viewer.openOnGithub))
    expect(open).toHaveBeenCalledWith("https://github.com/facebook/react/releases/tag/v19.0.0")
  })

  it("hides the open button and falls back to a generic label without a repo URL", () => {
    renderViewer(changelogItem, [])
    expect(screen.getByText("repository")).toBeInTheDocument()
    expect(screen.queryByText(fr.viewer.openOnGithub)).not.toBeInTheDocument()
  })

  it("omits the body when the release has no content", () => {
    const item = { ...changelogItem, item: { ...changelogItem.item, content: "" } } as TaggedItem
    renderViewer(item)
    expect(screen.queryByText("Title bold and code")).not.toBeInTheDocument()
  })
})

describe("youtube content", () => {
  it("embeds the video and links out to YouTube", () => {
    const { container } = renderViewer(youtubeItem)

    expect(screen.getByText("Ten React tricks")).toBeInTheDocument()
    expect(screen.getByText("@fireship")).toBeInTheDocument()
    expect(container.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/abc123",
    )

    fireEvent.click(screen.getByText(fr.viewer.watchOnYoutube))
    expect(open).toHaveBeenCalledWith("https://youtu.be/abc123")
  })

  it("extracts the video id from a watch?v= link", () => {
    const item = {
      ...youtubeItem,
      item: {
        ...youtubeItem.item,
        content: JSON.stringify({
          title: "T",
          link: "https://www.youtube.com/watch?v=xyz789",
        }),
      },
    } as TaggedItem
    const { container } = renderViewer(item)
    expect(container.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/xyz789",
    )
  })

  it("falls back to the thumbnail when the link has no video id", () => {
    const item = {
      ...youtubeItem,
      item: {
        ...youtubeItem.item,
        content: JSON.stringify({
          title: "T",
          thumbnail: "https://img.example.com/t.jpg",
          url: "https://www.youtube.com/@fireship",
          link: "not-a-url",
        }),
      },
    } as TaggedItem
    const { container } = renderViewer(item)

    expect(container.querySelector("iframe")).toBeNull()
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://img.example.com/t.jpg")
  })

  it("renders neither iframe nor thumbnail when the payload has only a channel URL", () => {
    const item = {
      ...youtubeItem,
      item: {
        ...youtubeItem.item,
        content: JSON.stringify({ title: "T", url: "https://www.youtube.com/@fireship" }),
      },
    } as TaggedItem
    const { container } = renderViewer(item)

    expect(container.querySelector("iframe")).toBeNull()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(fr.viewer.watchOnYoutube))
    expect(open).toHaveBeenCalledWith("https://www.youtube.com/@fireship")
  })

  it("falls back to the no-title label and hides the link when the payload is unparsable", () => {
    const item = { ...youtubeItem, item: { ...youtubeItem.item, content: "{bad" } } as TaggedItem
    renderViewer(item)

    expect(screen.getByText(fr.viewer.noTitle)).toBeInTheDocument()
    expect(screen.queryByText(fr.viewer.watchOnYoutube)).not.toBeInTheDocument()
  })
})

describe("rss content", () => {
  it("renders the title, source and HTML summary, and links out", () => {
    const { container } = renderViewer(rssItem)

    expect(screen.getByText("A blog post")).toBeInTheDocument()
    expect(screen.getByText("blog.example.com")).toBeInTheDocument()
    expect(container.querySelector(".rss-body")?.innerHTML).toBe(
      "<p>Hello <strong>world</strong></p>",
    )

    fireEvent.click(screen.getByText(fr.viewer.readArticle))
    expect(open).toHaveBeenCalledWith("https://www.blog.example.com/post")
  })

  it("omits the summary block and the link when the entry is bare", () => {
    const item = {
      ...rssItem,
      item: { ...rssItem.item, content: JSON.stringify({ title: "Bare" }) },
    } as TaggedItem
    const { container } = renderViewer(item)

    expect(container.querySelector(".rss-body")).toBeNull()
    expect(screen.queryByText(fr.viewer.readArticle)).not.toBeInTheDocument()
  })

  it("falls back to the no-title label when the payload is unparsable", () => {
    const item = { ...rssItem, item: { ...rssItem.item, content: "{bad" } } as TaggedItem
    renderViewer(item)
    expect(screen.getByText(fr.viewer.noTitle)).toBeInTheDocument()
  })
})

describe("scrap content", () => {
  it("renders the source URL, the body and links out", () => {
    renderViewer(scrapItem)

    expect(screen.getByText("https://news.example.com")).toBeInTheDocument()
    expect(screen.getByText("Scraped body text")).toBeInTheDocument()

    fireEvent.click(screen.getByText(fr.viewer.visitWebsite))
    expect(open).toHaveBeenCalledWith("https://news.example.com")
  })

  it("parses params supplied as a JSON string", () => {
    const item = {
      ...scrapItem,
      item: { ...scrapItem.item, params: JSON.stringify({ url: "https://stringly.example.com" }) },
    } as TaggedItem
    renderViewer(item)
    expect(screen.getByText("https://stringly.example.com")).toBeInTheDocument()
  })

  it("hides the source and the link when params cannot be parsed", () => {
    const item = { ...scrapItem, item: { ...scrapItem.item, params: "{bad" } } as TaggedItem
    renderViewer(item)

    expect(screen.getByText("Scraped body text")).toBeInTheDocument()
    expect(screen.queryByText(fr.viewer.visitWebsite)).not.toBeInTheDocument()
  })

  it("omits the body when there is no scraped content", () => {
    const item = { ...scrapItem, item: { ...scrapItem.item, content: "" } } as TaggedItem
    renderViewer(item)
    expect(screen.queryByText("Scraped body text")).not.toBeInTheDocument()
  })
})

describe("date fallbacks", () => {
  it.each([
    ["changelog", changelogItem],
    ["youtube", youtubeItem],
    ["rss", rssItem],
  ] as const)("falls back to executed_at when the %s item has no datetime", (_provider, base) => {
    const item = { ...base, item: { ...base.item, datetime: null } } as TaggedItem
    renderViewer(item)
    expect(screen.getByText(/2024/)).toBeInTheDocument()
  })
})

describe("channel name fallbacks", () => {
  it("uses the last path segment for a non-@ channel URL", () => {
    const item = {
      ...youtubeItem,
      item: {
        ...youtubeItem.item,
        content: JSON.stringify({ title: "T", url: "https://youtube.com/channel/UC42" }),
      },
    } as TaggedItem
    renderViewer(item)
    expect(screen.getByText("UC42")).toBeInTheDocument()
  })

  it("falls back to the raw URL when the path has no segments", () => {
    const item = {
      ...youtubeItem,
      item: {
        ...youtubeItem.item,
        content: JSON.stringify({ title: "T", url: "https://youtube.com/" }),
      },
    } as TaggedItem
    renderViewer(item)
    expect(screen.getByText("https://youtube.com/")).toBeInTheDocument()
  })

  it("uses an empty iframe title when the video has no title", () => {
    const item = {
      ...youtubeItem,
      item: { ...youtubeItem.item, content: JSON.stringify({ link: "https://youtu.be/abc123" }) },
    } as TaggedItem
    const { container } = renderViewer(item)
    expect(container.querySelector("iframe")).toHaveAttribute("title", "")
  })

  it("uses an empty img alt when the video has a thumbnail but no title", () => {
    const item = {
      ...youtubeItem,
      item: {
        ...youtubeItem.item,
        content: JSON.stringify({ thumbnail: "https://img.example.com/t.jpg" }),
      },
    } as TaggedItem
    const { container } = renderViewer(item)
    expect(container.querySelector("img")).toHaveAttribute("alt", "")
  })
})

describe("unparsable URLs", () => {
  it("falls back to the raw RSS link when the hostname cannot be parsed", () => {
    const item = {
      ...rssItem,
      item: { ...rssItem.item, content: JSON.stringify({ title: "T", link: "not-a-url" }) },
    } as TaggedItem
    renderViewer(item)
    expect(screen.getAllByText("not-a-url").length).toBeGreaterThan(0)
  })

  it("falls back to the raw channel URL when it cannot be parsed", () => {
    const item = {
      ...youtubeItem,
      item: { ...youtubeItem.item, content: JSON.stringify({ title: "T", url: "not-a-url" }) },
    } as TaggedItem
    renderViewer(item)
    expect(screen.getByText("not-a-url")).toBeInTheDocument()
  })
})

describe("provider inconnu", () => {
  it("renders the generic content with the capitalized provider label", () => {
    renderViewer(genericItem)
    expect(screen.getByText("Podcast")).toBeInTheDocument()
    expect(screen.getByText("s02e04")).toBeInTheDocument()
    expect(screen.getByText("Un épisode sur les flux RSS")).toBeInTheDocument()
  })

  it("omits the version and the body when the item carries neither", () => {
    renderViewer({
      ...genericItem,
      item: { ...genericItem.item, content: "", version: null },
    })
    expect(screen.getByText("Podcast")).toBeInTheDocument()
    expect(screen.queryByText("s02e04")).not.toBeInTheDocument()
    expect(screen.queryByText("Un épisode sur les flux RSS")).not.toBeInTheDocument()
  })

  it("falls back to executed_at when the item has no datetime", () => {
    renderViewer({ ...genericItem, item: { ...genericItem.item, datetime: null } })
    expect(screen.getByText("Podcast")).toBeInTheDocument()
  })
})
