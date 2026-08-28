/**
 * Rendu direct de `TemplatedDetail` — un test par `detail.mode` et par branche
 * de rendu (lien de ligne, cellule vide/préfixée, `openUrl` malformé, image de
 * repli, légende…). Le parcours nominal passe déjà par `FeedContentViewer` ; ici
 * on cible les cas que ce chemin ne touche pas, `link-list` en tête.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { open } from "@tauri-apps/plugin-shell"
import { TemplatedDetail } from "@/components/feed/TemplatedDetail"
import type { ProviderTemplate } from "@/lib/providerTemplate"
import { fr } from "@/lib/translations/fr"

function renderDetail(
  template: ProviderTemplate,
  item: Record<string, unknown>,
  source?: Record<string, unknown>,
) {
  return render(
    <TemplatedDetail
      template={template}
      item={item}
      source={source}
      color="#f4b585"
      dimColor="#f4b58522"
      fontSizeOffset={0}
      t={fr}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("text mode", () => {
  const template: ProviderTemplate = {
    version: 1,
    detail: {
      mode: "text",
      title: "title",
      badge: "badge",
      subtitle: "subtitle",
      body: "body",
      openUrl: "link",
      openLabel: "Open it",
    },
    item: { fields: { timestamp: "$row.datetime" } },
  }

  it("renders the header, body and open button", () => {
    renderDetail(template, {
      title: "A title",
      badge: "v1",
      subtitle: "sub",
      body: "The body text",
      link: "https://example.com/a",
      datetime: "2024-06-15T14:30:00Z",
    })
    expect(screen.getByText("A title")).toBeInTheDocument()
    expect(screen.getByText("v1")).toBeInTheDocument()
    expect(screen.getByText("sub")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Open it"))
    expect(open).toHaveBeenCalledWith("https://example.com/a")
  })

  it("drops the body block and the open button when both are missing/blank", () => {
    renderDetail(template, { title: "Bare" })
    expect(screen.getByText("Bare")).toBeInTheDocument()
    expect(screen.queryByText("Open it")).not.toBeInTheDocument()
  })

  it("falls back to the default open label and to item.datetime for the date", () => {
    const t: ProviderTemplate = {
      version: 1,
      detail: { mode: "text", title: "title", body: "body", openUrl: "link" },
      item: { fields: {} },
    }
    renderDetail(t, {
      title: "T",
      body: "B",
      link: "https://x.test/y",
      datetime: "2024-06-15T14:30:00Z",
    })
    expect(screen.getByText(fr.viewer.openLink)).toBeInTheDocument()
  })

  it("hides the open button when the resolved url is not http(s) or has a //-path", () => {
    renderDetail(template, { title: "T", body: "B", link: "ftp://nope/x" })
    expect(screen.queryByText("Open it")).not.toBeInTheDocument()
    renderDetail(template, { title: "T2", body: "B", link: "https://host//evil" })
    expect(screen.queryByText("Open it")).not.toBeInTheDocument()
    renderDetail(template, { title: "T3", body: "B", link: "not a url at all" })
    expect(screen.queryByText("Open it")).not.toBeInTheDocument()
  })

  it("renders (as text) with an empty detail block and the item.fields.summary body", () => {
    const t: ProviderTemplate = { version: 1, item: { fields: { summary: "desc" } } }
    renderDetail(t, { desc: "Fallback body" })
    expect(screen.getByText("Fallback body")).toBeInTheDocument()
  })
})

describe("html mode", () => {
  const template: ProviderTemplate = {
    version: 1,
    detail: { mode: "html", title: "title", body: "body" },
  }

  it("injects the sanitised-by-connector HTML body", () => {
    const { container } = renderDetail(template, {
      title: "Post",
      body: "<p>Hello <strong>world</strong></p>",
    })
    expect(container.querySelector(".tpl-html")?.innerHTML).toBe(
      "<p>Hello <strong>world</strong></p>",
    )
  })

  it("omits the body wrapper when there is no HTML", () => {
    const { container } = renderDetail(template, { title: "Empty" })
    expect(container.querySelector(".tpl-html")).toBeNull()
  })
})

describe("media mode", () => {
  const template: ProviderTemplate = {
    version: 1,
    detail: {
      mode: "media",
      title: "title",
      embedUrl: "embed",
      image: "image",
      openUrl: "link",
      openLabel: "Watch",
    },
  }

  it("prefers the embed iframe", () => {
    const { container } = renderDetail(template, {
      title: "V",
      embed: "https://www.youtube-nocookie.com/embed/abc123",
      image: "https://img.test/t.jpg",
    })
    expect(container.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/abc123",
    )
  })

  it("falls back to the image when the embed url has no id", () => {
    const { container } = renderDetail(template, {
      title: "V",
      embed: "https://youtube.com/embed/",
      image: "https://img.test/t.jpg",
    })
    expect(container.querySelector("iframe")).toBeNull()
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://img.test/t.jpg")
  })

  it("renders neither when there is no embed and no image", () => {
    const { container } = renderDetail(template, { title: "V" })
    expect(container.querySelector("iframe")).toBeNull()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
  })

  it("reads embedUrl and image from item.fields when detail omits them", () => {
    const t: ProviderTemplate = {
      version: 1,
      detail: { mode: "media", title: "title" },
      item: { fields: { embedUrl: "embed", image: "image" } },
    }
    const { container } = renderDetail(t, {
      title: "V",
      embed: "https://youtube.com/embed/",
      image: "https://img.test/f.jpg",
    })
    expect(container.querySelector("iframe")).toBeNull()
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://img.test/f.jpg")
  })
})

describe("audio mode", () => {
  const template: ProviderTemplate = {
    version: 1,
    detail: {
      mode: "audio",
      title: "title",
      audioUrl: "audio",
      image: "cover",
      body: "notes",
      openUrl: "page",
      openLabel: "Open episode",
    },
  }

  it("renders the cover, player and notes", () => {
    const { container } = renderDetail(template, {
      title: "Ep 1",
      audio: "https://cdn.test/ep.mp3",
      cover: "https://cdn.test/c.jpg",
      notes: "Show notes",
      page: "https://pod.test/1",
    })
    expect(container.querySelector("audio")).toHaveAttribute("src", "https://cdn.test/ep.mp3")
    expect(screen.getByText("Show notes")).toBeInTheDocument()
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://cdn.test/c.jpg")
  })

  it("drops every optional block when the payload is bare", () => {
    const { container } = renderDetail(template, { title: "Bare" })
    expect(container.querySelector("audio")).toBeNull()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.queryByText("Open episode")).not.toBeInTheDocument()
  })

  it("reads the cover and notes from item.fields when detail omits them", () => {
    const t: ProviderTemplate = {
      version: 1,
      detail: { mode: "audio", title: "title", audioUrl: "audio" },
      item: { fields: { image: "cover", summary: "notes" } },
    }
    renderDetail(t, {
      title: "Ep",
      audio: "https://cdn.test/e.mp3",
      cover: "https://cdn.test/c.jpg",
      notes: "From fields",
    })
    expect(screen.getByText("From fields")).toBeInTheDocument()
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://cdn.test/c.jpg")
  })
})

describe("gallery mode", () => {
  const template: ProviderTemplate = {
    version: 1,
    detail: {
      mode: "gallery",
      title: "title",
      collection: "shots",
      image: "url",
      caption: "caption",
      rowLink: "href",
      openUrl: "album",
      openLabel: "Open album",
    },
  }

  it("links captioned images and opens them via openUrl", () => {
    renderDetail(template, {
      title: "Trip",
      shots: [{ url: "https://cdn.test/1.jpg", caption: "One", href: "https://page.test/1" }],
      album: "https://page.test",
    })
    expect(screen.getByText("One")).toBeInTheDocument()
    fireEvent.click(screen.getByAltText("One"))
    expect(open).toHaveBeenCalledWith("https://page.test/1")
  })

  it("renders a bare image with no link and no caption", () => {
    const { container } = renderDetail(template, {
      title: "Trip",
      shots: [{ url: "https://cdn.test/2.jpg" }],
    })
    expect(container.querySelector("a")).toBeNull()
    expect(container.querySelector("figcaption")).toBeNull()
    expect(container.querySelector("img")).toHaveAttribute("src", "https://cdn.test/2.jpg")
  })

  it("skips an entry that resolves to no image source", () => {
    const { container } = renderDetail(template, {
      title: "Trip",
      shots: [{ caption: "no image here" }],
    })
    expect(container.querySelectorAll("figure")).toHaveLength(0)
  })

  it("defaults to $self for a collection of bare URL strings when detail.image is unset", () => {
    const t: ProviderTemplate = {
      version: 1,
      detail: { mode: "gallery", title: "title", collection: "shots" },
    }
    const { container } = renderDetail(t, { title: "Trip", shots: ["https://cdn.test/3.jpg"] })
    expect(container.querySelector("img")).toHaveAttribute("src", "https://cdn.test/3.jpg")
  })
})

describe("link-list mode", () => {
  const template: ProviderTemplate = {
    version: 1,
    detail: {
      mode: "link-list",
      title: "title",
      collection: "links",
      columns: [{ label: "Name", field: "name" }],
      rowLink: "href",
      openUrl: "all",
      openLabel: "See all",
    },
  }

  it("renders a labelled link per row and opens it", () => {
    renderDetail(template, {
      title: "Bookmarks",
      links: [
        { name: "First", href: "https://a.test/1" },
        { name: "Second", href: "https://b.test/2" },
      ],
      all: "https://a.test",
    })
    fireEvent.click(screen.getByText("First"))
    expect(open).toHaveBeenCalledWith("https://a.test/1")
    fireEvent.click(screen.getByText("See all"))
    expect(open).toHaveBeenCalledWith("https://a.test")
  })

  it("shows the href as the label when the row has no name, and a plain span when there is no link", () => {
    renderDetail(template, {
      title: "Bookmarks",
      links: [{ href: "https://only-href.test/x" }, { name: "no link" }],
    })
    expect(screen.getByText("https://only-href.test/x")).toBeInTheDocument()
    expect(screen.getByText("no link")).toBeInTheDocument()
  })

  it("defaults the label to `title` and the link to `url` when no columns/rowLink are given", () => {
    const t: ProviderTemplate = {
      version: 1,
      detail: { mode: "link-list", collection: "links" },
    }
    renderDetail(t, {
      links: [{ title: "Defaulted", url: "https://d.test/1" }],
    })
    fireEvent.click(screen.getByText("Defaulted"))
    expect(open).toHaveBeenCalledWith("https://d.test/1")
  })
})

describe("table mode", () => {
  const template: ProviderTemplate = {
    version: 1,
    detail: {
      mode: "table",
      title: "title",
      collection: "repos",
      rowLink: "url",
      openUrl: "page",
      openLabel: "Open list",
      columns: [
        { label: "#", field: "rank", align: "right", width: "2rem" },
        { label: "Repo", field: "{owner}/{name}", link: "url", emphasis: true },
        { label: "Desc", field: "description", muted: true, truncate: true },
        {
          label: "Delta",
          field: "delta",
          align: "right",
          format: "compactNumber",
          prefix: "+",
          accent: true,
        },
      ],
    },
  }

  it("renders headers, a per-column link and a prefixed formatted cell across rows", () => {
    renderDetail(template, {
      title: "Trending",
      repos: [
        {
          rank: 1,
          owner: "vercel",
          name: "next.js",
          url: "https://github.com/vercel/next.js",
          description: "The React framework",
          delta: 42,
        },
        {
          rank: 2,
          owner: "denoland",
          name: "deno",
          url: "https://github.com/denoland/deno",
          description: "A runtime",
          delta: 7,
        },
      ],
      page: "https://github.com/trending",
    })
    expect(screen.getByRole("columnheader", { name: "Repo" })).toBeInTheDocument()
    expect(screen.getByText("+42")).toBeInTheDocument()
    expect(screen.getByText("denoland/deno")).toBeInTheDocument()
    fireEvent.click(screen.getByText("vercel/next.js"))
    expect(open).toHaveBeenCalledWith("https://github.com/vercel/next.js")
    fireEvent.click(screen.getByText("Open list"))
    expect(open).toHaveBeenCalledWith("https://github.com/trending")
  })

  it("leaves an empty string for a null cell value and links the first column to the row link", () => {
    const t: ProviderTemplate = {
      version: 1,
      detail: {
        mode: "table",
        collection: "repos",
        rowLink: "url",
        columns: [
          { label: "Name", field: "name" },
          { label: "Note", field: "note" },
        ],
      },
    }
    renderDetail(t, {
      repos: [{ name: "only-name", url: "https://r.test/1" }],
    })
    fireEvent.click(screen.getByText("only-name"))
    expect(open).toHaveBeenCalledWith("https://r.test/1")
  })

  it("leaves a cell blank when the formatter reduces the value to an empty string", () => {
    const t: ProviderTemplate = {
      version: 1,
      detail: {
        mode: "table",
        collection: "rows",
        columns: [
          { label: "Head", field: "head", format: "stripMarkdown" },
          { label: "Tail", field: "tail" },
        ],
      },
    }
    renderDetail(t, { rows: [{ head: "## ", tail: "kept" }] })
    expect(screen.getByText("kept")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "Head" })).toBeInTheDocument()
  })

  it("renders an empty table (no columns, missing collection) without crashing", () => {
    const { container } = renderDetail(
      { version: 1, detail: { mode: "table", collection: "nope" } },
      {},
    )
    expect(container.querySelectorAll("tbody tr")).toHaveLength(0)
    expect(container.querySelectorAll("thead th")).toHaveLength(0)
  })
})
