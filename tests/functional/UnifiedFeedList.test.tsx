import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { UnifiedFeedList } from "@/components/feed/UnifiedFeedList"
import { LanguageProvider } from "@/context/LanguageContext"
import { fr } from "@/lib/translations/fr"
import type { TaggedItem } from "@/types"
import { TEMPLATES } from "./_templates"

const repositories = [
  { repository_id: 1, url: "https://github.com/facebook/react", provider: "changelog" },
  { repository_id: 2, url: "https://www.youtube.com/@fireship", provider: "youtube" },
]

const changelogItem: TaggedItem = {
  provider: "changelog",
  item: {
    id: 1,
    repository_id: 1,
    content: "## Heading\r\nSome release notes",
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
      summary: "Summary",
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
    content: "Scraped headline text",
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

function renderList(props: Partial<React.ComponentProps<typeof UnifiedFeedList>> = {}) {
  const onSelect = vi.fn()
  const view = render(
    <LanguageProvider initialLang="fr">
      <UnifiedFeedList
        items={[changelogItem, youtubeItem, rssItem, scrapItem]}
        selectedIndex={null}
        onSelect={onSelect}
        repositories={repositories}
        templates={TEMPLATES}
        {...props}
      />
    </LanguageProvider>,
  )
  return { ...view, onSelect }
}

describe("UnifiedFeedList", () => {
  it("shows the empty message when there are no items", () => {
    renderList({ items: [] })
    expect(screen.getByText(fr.feed.noContent)).toBeInTheDocument()
  })

  it("renders one row per item", () => {
    const { container } = renderList()
    expect(container.querySelectorAll("[data-index]")).toHaveLength(4)
  })

  it("calls onSelect with the clicked index", () => {
    const { container, onSelect } = renderList()
    fireEvent.click(container.querySelector('[data-index="1"]')!)
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it("highlights the selected row", () => {
    const { container } = renderList({ selectedIndex: 0 })
    const row = container.querySelector<HTMLElement>('[data-index="0"]')!
    expect(row.style.background).toBe("var(--surface-2)")
    expect(row.style.opacity).toBe("1")
  })

  it("dims rows that are already read", () => {
    const { container } = renderList({ readIds: new Set(["changelog:1"]) })
    expect(container.querySelector<HTMLElement>('[data-index="0"]')!.style.opacity).toBe("0.45")
    expect(container.querySelector<HTMLElement>('[data-index="1"]')!.style.opacity).toBe("1")
  })

  it("keeps a read row at full opacity while it is selected", () => {
    const { container } = renderList({ readIds: new Set(["changelog:1"]), selectedIndex: 0 })
    expect(container.querySelector<HTMLElement>('[data-index="0"]')!.style.opacity).toBe("1")
  })
})

describe("changelog entries (template: row)", () => {
  it("shows the repo slug, the version and the stripped snippet", () => {
    renderList({ items: [changelogItem] })
    expect(screen.getByText("facebook/react")).toBeInTheDocument()
    expect(screen.getByText("v19.0.0")).toBeInTheDocument()
    expect(screen.getByText("Heading Some release notes")).toBeInTheDocument()
  })

  it("shows a dash title when the source repository is unknown", () => {
    renderList({ items: [changelogItem], repositories: [] })
    expect(screen.getByText("v19.0.0")).toBeInTheDocument()
    expect(screen.getByText("—")).toBeInTheDocument()
  })

  it("omits the snippet when the release has no body", () => {
    const item = { ...changelogItem, item: { ...changelogItem.item, content: "" } } as TaggedItem
    const { container } = renderList({ items: [item] })
    expect(container.querySelector("p.line-clamp-1")).toBeNull()
  })
})

describe("youtube entries (template: media)", () => {
  it("shows the thumbnail, title and channel handle", () => {
    renderList({ items: [youtubeItem] })
    expect(screen.getByRole("img", { name: "Ten React tricks" })).toBeInTheDocument()
    expect(screen.getByText("Ten React tricks")).toBeInTheDocument()
    expect(screen.getByText("@fireship")).toBeInTheDocument()
  })

  it("shows a placeholder when there is no thumbnail", () => {
    const item = {
      ...youtubeItem,
      item: {
        ...youtubeItem.item,
        content: JSON.stringify({ title: "No thumb", url: "https://youtube.com/c/legacy" }),
      },
    } as TaggedItem
    renderList({ items: [item] })
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.getByText("c/legacy")).toBeInTheDocument()
  })

  it("renders a dash when the payload is unparsable", () => {
    const item = { ...youtubeItem, item: { ...youtubeItem.item, content: "{oops" } } as TaggedItem
    renderList({ items: [item] })
    expect(screen.getByText("—")).toBeInTheDocument()
  })

  it("keeps the channel path for a /channel/ URL", () => {
    const item = {
      ...youtubeItem,
      item: {
        ...youtubeItem.item,
        content: JSON.stringify({ title: "T", url: "https://youtube.com/channel/UC42" }),
      },
    } as TaggedItem
    renderList({ items: [item] })
    expect(screen.getByText("channel/UC42")).toBeInTheDocument()
  })
})

describe("rss entries (template: row)", () => {
  it("shows the title and the source hostname without www", () => {
    renderList({ items: [rssItem] })
    expect(screen.getByText("A blog post")).toBeInTheDocument()
    expect(screen.getByText("blog.example.com")).toBeInTheDocument()
  })

  it("renders a dash when the payload is unparsable", () => {
    const item = { ...rssItem, item: { ...rssItem.item, content: "nope" } } as TaggedItem
    renderList({ items: [item] })
    expect(screen.getByText("—")).toBeInTheDocument()
  })

  it("omits the source line when the entry has no link", () => {
    const item = {
      ...rssItem,
      item: { ...rssItem.item, content: JSON.stringify({ title: "No link" }) },
    } as TaggedItem
    renderList({ items: [item] })
    expect(screen.getByText("No link")).toBeInTheDocument()
    expect(screen.queryByText("blog.example.com")).not.toBeInTheDocument()
  })

  it("falls back to the raw link when the hostname cannot be parsed", () => {
    const item = {
      ...rssItem,
      item: { ...rssItem.item, content: JSON.stringify({ title: "T", link: "not-a-url" }) },
    } as TaggedItem
    renderList({ items: [item] })
    expect(screen.getByText("not-a-url")).toBeInTheDocument()
  })
})

describe("scrap entries (template: row)", () => {
  it("shows the scraped excerpt and the source hostname", () => {
    renderList({ items: [scrapItem] })
    expect(screen.getByText("Scraped headline text")).toBeInTheDocument()
    expect(screen.getByText("news.example.com")).toBeInTheDocument()
  })

  it("parses params supplied as a JSON string", () => {
    const item = {
      ...scrapItem,
      item: { ...scrapItem.item, params: JSON.stringify({ url: "https://stringly.example.com" }) },
    } as TaggedItem
    renderList({ items: [item] })
    expect(screen.getByText("stringly.example.com")).toBeInTheDocument()
  })

  it("omits the source line when params cannot be parsed", () => {
    const item = { ...scrapItem, item: { ...scrapItem.item, params: "{bad" } } as TaggedItem
    renderList({ items: [item] })
    expect(screen.getByText("Scraped headline text")).toBeInTheDocument()
    expect(screen.queryByText("news.example.com")).not.toBeInTheDocument()
  })

  it("falls back to the source hostname as the title when there is no content", () => {
    const item = {
      ...scrapItem,
      item: { ...scrapItem.item, content: null },
    } as unknown as TaggedItem
    renderList({ items: [item] })
    expect(screen.getAllByText("news.example.com").length).toBeGreaterThan(0)
  })
})

describe("date fallbacks", () => {
  it.each([
    ["changelog", changelogItem],
    ["rss", rssItem],
  ] as const)("falls back to executed_at when the %s item has no datetime", (_provider, base) => {
    const item = { ...base, item: { ...base.item, datetime: null } } as TaggedItem
    renderList({ items: [item] })
    expect(screen.getByText(/2024/)).toBeInTheDocument()
  })
})

describe("provider without a template", () => {
  it("renders a generic row with the capitalized provider label", () => {
    renderList({ items: [genericItem] })
    expect(screen.getByText("Un épisode sur les flux RSS")).toBeInTheDocument()
    expect(screen.getByText("Podcast")).toBeInTheDocument()
  })

  it("falls back to the provider label when the item has no content", () => {
    renderList({ items: [{ ...genericItem, item: { ...genericItem.item, content: "" } }] })
    expect(screen.getAllByText("Podcast")).toHaveLength(2)
  })
})
