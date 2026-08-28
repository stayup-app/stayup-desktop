import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { open } from "@tauri-apps/plugin-shell"
import { FeedContentViewer } from "@/components/feed/FeedContentViewer"
import { LanguageProvider } from "@/context/LanguageContext"
import { fr } from "@/lib/translations/fr"
import type { TaggedItem } from "@/types"
import { buildTemplateMap } from "@/lib/providerTemplate"
import { TEMPLATES } from "./_templates"

const MEDIA_TEMPLATES = buildTemplateMap([
  {
    name: "podcast",
    displayName: "Podcast",
    template: {
      version: 1,
      display: { name: "Podcast", accent: "#c5b1e8" },
      item: { parseContentAsJson: true, fields: { title: "title" } },
      detail: {
        mode: "audio",
        title: "title",
        image: "cover",
        audioUrl: "audio",
        body: "notes",
        openUrl: "page",
        openLabel: "Open episode",
      },
    },
  },
  {
    name: "photos",
    displayName: "Photos",
    template: {
      version: 1,
      display: { name: "Photos", accent: "#a8d4b5" },
      item: { parseContentAsJson: true, fields: { title: "album" } },
      detail: {
        mode: "gallery",
        title: "album",
        collection: "shots",
        image: "url",
        caption: "caption",
        rowLink: "url",
        openLabel: "Open album",
      },
    },
  },
])

const LS_FONT_KEY = "STAYUP_FONT_SIZE_OFFSET"

const repositories = [
  { repository_id: 1, url: "https://github.com/facebook/react", provider: "changelog" },
]

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

const trendingItem: TaggedItem = {
  provider: "github_trending",
  item: {
    id: 6,
    repository_id: 6,
    version: "daily@2024-06-16",
    content: JSON.stringify({
      since: "daily",
      url: "https://github.com/trending?since=daily",
      count: 1,
      fetched_at: "2024-06-16T00:00:03Z",
      repos: [
        {
          rank: 1,
          owner: "vercel",
          name: "next.js",
          url: "https://github.com/vercel/next.js",
          description: "The React Framework",
          language: "TypeScript",
          stars: 129000,
          forks: 27600,
          stars_period: 318,
        },
      ],
    }),
    datetime: "2024-06-16T00:00:03Z",
    executed_at: "2024-06-16T00:00:03Z",
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

function renderViewer(item: TaggedItem | null, repos = repositories, templates = TEMPLATES) {
  return render(
    <LanguageProvider initialLang="fr">
      <FeedContentViewer item={item} repositories={repos} templates={templates} />
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
    expect(screen.getByLabelText("Agrandir la police")).toBeDisabled()
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

describe("changelog content (template: text)", () => {
  it("shows the repo slug, version and markdown-stripped body", () => {
    renderViewer(changelogItem)
    expect(screen.getByText("facebook/react")).toBeInTheDocument()
    expect(screen.getByText("v19.0.0")).toBeInTheDocument()
    expect(screen.getByText("Title bold and code")).toBeInTheDocument()
  })

  it("opens the release page on GitHub", () => {
    renderViewer(changelogItem)
    fireEvent.click(screen.getByText("Open on GitHub"))
    expect(open).toHaveBeenCalledWith("https://github.com/facebook/react/releases/tag/v19.0.0")
  })

  it("hides the open button when the source repository is unknown", () => {
    renderViewer(changelogItem, [])
    expect(screen.getByText("v19.0.0")).toBeInTheDocument()
    expect(screen.queryByText("Open on GitHub")).not.toBeInTheDocument()
  })

  it("omits the body when the release has no content", () => {
    const item = { ...changelogItem, item: { ...changelogItem.item, content: "" } } as TaggedItem
    renderViewer(item)
    expect(screen.queryByText("Title bold and code")).not.toBeInTheDocument()
  })
})

describe("youtube content (template: media)", () => {
  it("embeds the video and links out to YouTube", () => {
    const { container } = renderViewer(youtubeItem)
    expect(screen.getByText("Ten React tricks")).toBeInTheDocument()
    expect(screen.getByText("@fireship")).toBeInTheDocument()
    expect(container.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/abc123",
    )
    fireEvent.click(screen.getByText("Watch on YouTube"))
    expect(open).toHaveBeenCalledWith("https://youtu.be/abc123")
  })

  it("falls back to the thumbnail when there is no video id", () => {
    const item = {
      ...youtubeItem,
      item: {
        ...youtubeItem.item,
        version: "",
        content: JSON.stringify({
          title: "T",
          thumbnail: "https://img.example.com/t.jpg",
          url: "https://www.youtube.com/@fireship",
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
        version: "",
        content: JSON.stringify({ title: "T", url: "https://www.youtube.com/@fireship" }),
      },
    } as TaggedItem
    const { container } = renderViewer(item)
    expect(container.querySelector("iframe")).toBeNull()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("Watch on YouTube"))
    expect(open).toHaveBeenCalledWith("https://www.youtube.com/@fireship")
  })

  it("hides the watch link when the payload is unparsable", () => {
    const item = {
      ...youtubeItem,
      item: { ...youtubeItem.item, version: "", content: "{bad" },
    } as TaggedItem
    renderViewer(item)
    expect(screen.getByLabelText("Agrandir la police")).toBeInTheDocument()
    expect(screen.queryByText("Watch on YouTube")).not.toBeInTheDocument()
  })
})

describe("rss content (template: html)", () => {
  it("renders the title, source and HTML summary, and links out", () => {
    const { container } = renderViewer(rssItem)
    expect(screen.getByText("A blog post")).toBeInTheDocument()
    expect(screen.getByText("blog.example.com")).toBeInTheDocument()
    expect(container.querySelector(".tpl-html")?.innerHTML).toBe(
      "<p>Hello <strong>world</strong></p>",
    )
    fireEvent.click(screen.getByText("Read article"))
    expect(open).toHaveBeenCalledWith("https://www.blog.example.com/post")
  })

  it("omits the summary block when the entry is bare", () => {
    const item = {
      ...rssItem,
      item: { ...rssItem.item, content: JSON.stringify({ title: "Bare" }) },
    } as TaggedItem
    const { container } = renderViewer(item)
    expect(container.querySelector(".tpl-html")).toBeNull()
    expect(screen.queryByText("Read article")).not.toBeInTheDocument()
  })
})

describe("scrap content (template: text)", () => {
  it("renders the source hostname, the body and links out", () => {
    renderViewer(scrapItem)
    expect(screen.getByText("news.example.com")).toBeInTheDocument()
    expect(screen.getByText("Scraped body text")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Visit website"))
    expect(open).toHaveBeenCalledWith("https://news.example.com")
  })

  it("parses params supplied as a JSON string", () => {
    const item = {
      ...scrapItem,
      item: { ...scrapItem.item, params: JSON.stringify({ url: "https://stringly.example.com" }) },
    } as TaggedItem
    renderViewer(item)
    expect(screen.getByText("stringly.example.com")).toBeInTheDocument()
  })

  it("hides the link when params cannot be parsed", () => {
    const item = { ...scrapItem, item: { ...scrapItem.item, params: "{bad" } } as TaggedItem
    renderViewer(item)
    expect(screen.getByText("Scraped body text")).toBeInTheDocument()
    expect(screen.queryByText("Visit website")).not.toBeInTheDocument()
  })
})

describe("audio & gallery modes", () => {
  it("renders an audio episode with a player and open button", () => {
    const { container } = renderViewer(
      {
        provider: "podcast",
        item: {
          id: 6,
          repository_id: 6,
          content: JSON.stringify({
            title: "Episode 12",
            cover: "https://cdn.example.com/c.jpg",
            audio: "https://cdn.example.com/ep.mp3",
            notes: "Show notes here",
            page: "https://pod.example.com/12",
          }),
          datetime: "2024-06-16T00:00:00Z",
          executed_at: "2024-06-16T00:00:00Z",
          success: true,
        },
      } as TaggedItem,
      repositories,
      MEDIA_TEMPLATES,
    )
    expect(screen.getByText("Episode 12")).toBeInTheDocument()
    expect(container.querySelector("audio")).toHaveAttribute(
      "src",
      "https://cdn.example.com/ep.mp3",
    )
    expect(screen.getByText("Show notes here")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Open episode"))
    expect(open).toHaveBeenCalledWith("https://pod.example.com/12")
  })

  it("renders a gallery of images with captions", () => {
    renderViewer(
      {
        provider: "photos",
        item: {
          id: 7,
          repository_id: 7,
          content: JSON.stringify({
            album: "Kyoto",
            shots: [
              { url: "https://cdn.example.com/1.jpg", caption: "Fushimi Inari" },
              { url: "https://cdn.example.com/2.jpg", caption: "Arashiyama" },
            ],
          }),
          datetime: "2024-06-17T00:00:00Z",
          executed_at: "2024-06-17T00:00:00Z",
          success: true,
        },
      } as TaggedItem,
      repositories,
      MEDIA_TEMPLATES,
    )
    expect(screen.getByText("Kyoto")).toBeInTheDocument()
    expect(screen.getByAltText("Fushimi Inari")).toHaveAttribute(
      "src",
      "https://cdn.example.com/1.jpg",
    )
    expect(screen.getByText("Arashiyama")).toBeInTheDocument()
  })
})

describe("github-trending content (template: table)", () => {
  it("renders the embedded repository list as a table", () => {
    renderViewer(trendingItem)
    expect(screen.getByText("Trending today")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Repository" })).toBeInTheDocument()
    expect(screen.getByText("vercel/next.js")).toBeInTheDocument()
    expect(screen.getByText("The React Framework")).toBeInTheDocument()
    expect(screen.getByText("+318")).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Open on github\.com\/trending/))
    expect(open).toHaveBeenCalledWith("https://github.com/trending?since=daily")
  })
})

describe("provider without a template", () => {
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
})
