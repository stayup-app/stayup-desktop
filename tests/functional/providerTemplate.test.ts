/**
 * Couverture directe du moteur de templates (`src/lib/providerTemplate.ts`).
 *
 * Le moteur est pur : chaque fonction exportée et chaque branche est exercée ici,
 * sans passer par un composant. Les composants `Templated*` n'en testent que le
 * chemin nominal ; les cas limites (formats non parsables, accesseurs vides,
 * regex invalides, `flux` déjà URL…) vivent ici.
 */
import {
  applyFormTransform,
  applyFormat,
  buildFluxUrl,
  buildTemplateMap,
  elementCtx,
  matchesFormPattern,
  normalizeTemplate,
  resolveAccessor,
  resolveCollection,
  resolveFeedLabel,
  resolveIcon,
  resolveItemView,
  resolveOpenUrl,
  resolveText,
  stripScheme,
  usableEmbedUrl,
  type ProviderTemplate,
  type ResolveCtx,
} from "@/lib/providerTemplate"

const ctxOf = (over: Partial<ResolveCtx> = {}): ResolveCtx => ({
  row: {},
  source: {},
  base: {},
  vars: {},
  ...over,
})

describe("normalizeTemplate", () => {
  it("parses a JSON string payload", () => {
    expect(normalizeTemplate('{"version":1}')).toEqual({ version: 1 })
  })

  it("returns null for an unparseable string", () => {
    expect(normalizeTemplate("{not json")).toBeNull()
  })

  it("returns null for non-objects", () => {
    expect(normalizeTemplate(null)).toBeNull()
    expect(normalizeTemplate(42)).toBeNull()
    expect(normalizeTemplate(undefined)).toBeNull()
  })

  it("returns null for an unknown or missing version", () => {
    expect(normalizeTemplate({ version: 2 })).toBeNull()
    expect(normalizeTemplate({})).toBeNull()
  })

  it("passes a v1 object through unchanged", () => {
    const tpl = { version: 1, detail: { mode: "text" } }
    expect(normalizeTemplate(tpl)).toBe(tpl)
  })
})

describe("buildTemplateMap", () => {
  it("indexes providers by name and normalizes each template", () => {
    const map = buildTemplateMap([
      { name: "a", displayName: "A", template: { version: 1 } },
      { name: "b", template: '{"version":1}' },
      { name: "c", template: { version: 9 } },
    ])
    expect(map.a.displayName).toBe("A")
    expect(map.a.template).toEqual({ version: 1 })
    expect(map.b.displayName).toBe("b") // no displayName → falls back to the name
    expect(map.b.template).toEqual({ version: 1 })
    expect(map.c.template).toBeNull()
  })

  it("tolerates an undefined list", () => {
    expect(buildTemplateMap(undefined)).toEqual({})
  })
})

describe("applyFormat", () => {
  it("returns the value untouched without a format or for null", () => {
    expect(applyFormat("x", undefined)).toBe("x")
    expect(applyFormat(null, "upper")).toBeNull()
  })

  it("compactNumber formats a finite number and echoes anything else", () => {
    expect(String(applyFormat(12000, "compactNumber"))).toMatch(/12/)
    expect(applyFormat("not-a-number", "compactNumber")).toBe("not-a-number")
  })

  it("date / datetime / relativeTime format a parseable date, echo an unparseable one", () => {
    expect(String(applyFormat("2024-01-15T10:00:00Z", "date"))).toMatch(/2024/)
    expect(String(applyFormat("2024-01-15T10:00:00Z", "datetime"))).toMatch(/2024/)
    expect(String(applyFormat("2024-01-15T10:00:00Z", "relativeTime"))).toMatch(/2024/)
    expect(applyFormat("whenever", "date")).toBe("whenever")
  })

  it("urlSlug trims the pathname, else echoes the input", () => {
    expect(applyFormat("https://github.com/facebook/react/", "urlSlug")).toBe("facebook/react")
    expect(applyFormat("facebook/react", "urlSlug")).toBe("facebook/react")
  })

  it("hostname drops www., else echoes the input", () => {
    expect(applyFormat("https://www.example.com/x", "hostname")).toBe("example.com")
    expect(applyFormat("nope", "hostname")).toBe("nope")
  })

  it("stripMarkdown removes headings, bold and inline code", () => {
    expect(applyFormat("## Title **bold** `code`", "stripMarkdown")).toBe("Title bold code")
  })

  it("upper / lower", () => {
    expect(applyFormat("aB", "upper")).toBe("AB")
    expect(applyFormat("aB", "lower")).toBe("ab")
  })

  it("an unknown format echoes the value", () => {
    expect(applyFormat("x", "weird" as never)).toBe("x")
  })
})

describe("resolveAccessor — path roots", () => {
  it("`content` special-cases the raw row content", () => {
    expect(resolveAccessor("content", ctxOf({ row: { content: "hello" } }))).toBe("hello")
    expect(resolveAccessor("content", ctxOf({ row: {} }))).toBe("")
  })

  it("$row / $source / $vars / $self roots", () => {
    const ctx = ctxOf({
      row: { a: 1 },
      source: { url: "u" },
      vars: { v: "V" },
      base: { deep: { x: 2 } },
    })
    expect(resolveAccessor("$row.a", ctx)).toBe(1)
    expect(resolveAccessor("$source.url", ctx)).toBe("u")
    expect(resolveAccessor("$vars.v", ctx)).toBe("V")
    expect(resolveAccessor("$self.deep.x", ctx)).toBe(2)
    expect(resolveAccessor("$self", ctx)).toEqual({ deep: { x: 2 } })
  })

  it("a bare name resolves a computed var first, then a base key", () => {
    expect(resolveAccessor("repo", ctxOf({ vars: { repo: "R" }, base: { repo: "B" } }))).toBe("R")
    expect(resolveAccessor("repo", ctxOf({ base: { repo: "B" } }))).toBe("B")
  })

  it("digs through nested JSON stored as a string", () => {
    const ctx = ctxOf({ base: { meta: JSON.stringify({ nested: "deep" }) } })
    expect(resolveAccessor("meta.nested", ctx)).toBe("deep")
  })

  it("bails to undefined on a null link or a non-object segment", () => {
    expect(resolveAccessor("a.b.c", ctxOf({ base: { a: null } }))).toBeUndefined()
    expect(resolveAccessor("a.b", ctxOf({ base: { a: 5 } }))).toBeUndefined()
  })

  it("bails to undefined when an intermediate segment is a plain or malformed-JSON string", () => {
    expect(resolveAccessor("a.b", ctxOf({ base: { a: "plainstring" } }))).toBeUndefined()
    expect(resolveAccessor("a.b", ctxOf({ base: { a: "{bad json" } }))).toBeUndefined()
  })

  it("trims whitespace around a path", () => {
    expect(resolveAccessor("  $row.a  ", ctxOf({ row: { a: 7 } }))).toBe(7)
  })
})

describe("resolveAccessor — accessor shapes", () => {
  it("null / undefined accessor → null", () => {
    expect(resolveAccessor(undefined, ctxOf())).toBeNull()
  })

  it("array → first non-empty candidate, else null", () => {
    const ctx = ctxOf({ base: { a: "", b: "  ", c: "third" } })
    expect(resolveAccessor(["a", "b", "c"], ctx)).toBe("third")
    expect(resolveAccessor(["a", "b"], ctx)).toBeNull()
  })

  it("a string containing `{}` is filled as a template, blanks stay blank", () => {
    const ctx = ctxOf({ base: { owner: "facebook", name: "react" } })
    expect(resolveAccessor("{owner}/{name}", ctx)).toBe("facebook/react")
    expect(resolveAccessor("{missing}!", ctxOf())).toBe("!")
  })

  it("{ template, format } fills then formats", () => {
    const ctx = ctxOf({ base: { host: "https://www.EXAMPLE.com/p" } })
    expect(resolveAccessor({ template: "{host}", format: "hostname" }, ctx)).toBe("example.com")
  })

  it("{ path, cases, fallback } maps known cases, keeps unknown, falls back on empty", () => {
    const ctx = ctxOf({ base: { since: "daily", n: null } })
    expect(resolveAccessor({ path: "since", cases: { daily: "today" } }, ctx)).toBe("today")
    expect(resolveAccessor({ path: "since", cases: { weekly: "wk" } }, ctx)).toBe("daily")
    expect(resolveAccessor({ path: "n", fallback: "—" }, ctx)).toBe("—")
    expect(resolveAccessor({ path: "n" }, ctx)).toBeNull()
  })
})

describe("resolveText", () => {
  it("coerces to a string, '' when the accessor is empty", () => {
    expect(resolveText("a", ctxOf({ base: { a: 7 } }))).toBe("7")
    expect(resolveText("missing", ctxOf())).toBe("")
    expect(resolveText(undefined, ctxOf())).toBe("")
  })
})

describe("makeCtx / resolveItemView", () => {
  const tpl: ProviderTemplate = {
    version: 1,
    item: {
      parseContentAsJson: true,
      vars: { repo: { path: "$source.url", format: "urlSlug" } },
      fields: {
        title: "{repo}",
        subtitle: "name",
        summary: "desc",
        image: "img",
        url: "link",
        timestamp: "published",
      },
    },
  }

  it("parses row.content as JSON for the base, resolving vars then fields", () => {
    const view = resolveItemView(
      tpl,
      {
        content: JSON.stringify({
          name: "N",
          desc: "D",
          img: "I",
          link: "L",
          published: "2024-01-01",
        }),
      },
      { url: "https://github.com/a/b/" },
    )
    expect(view).toMatchObject({
      title: "a/b",
      subtitle: "N",
      summary: "D",
      image: "I",
      url: "L",
      timestamp: "2024-01-01",
    })
  })

  it("falls back to the row when content is not JSON", () => {
    const view = resolveItemView(
      tpl,
      { content: "plain", name: "row-name" } as Record<string, unknown>,
      undefined,
    )
    expect(view.subtitle).toBe("row-name")
  })

  it("keeps the row as base when the parsed content is null", () => {
    const t: ProviderTemplate = {
      version: 1,
      item: { parseContentAsJson: true, fields: { subtitle: "k" } },
    }
    const view = resolveItemView(
      t,
      { content: "null", k: "kept" } as Record<string, unknown>,
      undefined,
    )
    expect(view.subtitle).toBe("kept")
  })

  it("keeps the row as base when parseContentAsJson is set but the row carries no content", () => {
    const t: ProviderTemplate = {
      version: 1,
      item: { parseContentAsJson: true, fields: { subtitle: "k" } },
    }
    const view = resolveItemView(t, { k: "kept" } as Record<string, unknown>, undefined)
    expect(view.subtitle).toBe("kept")
  })

  it("uses row.datetime then row.executed_at when no timestamp field resolves", () => {
    const bare: ProviderTemplate = { version: 1, item: { fields: {} } }
    expect(resolveItemView(bare, { datetime: "D1" }, undefined).timestamp).toBe("D1")
    expect(resolveItemView(bare, { executed_at: "E1" }, undefined).timestamp).toBe("E1")
    expect(resolveItemView(bare, {}, undefined).timestamp).toBe("")
  })

  it("handles a template with no item block at all", () => {
    const view = resolveItemView({ version: 1 }, { datetime: "x" }, undefined)
    expect(view.title).toBe("")
    expect(view.image).toBeNull()
    expect(view.url).toBeNull()
  })
})

describe("resolveCollection / elementCtx", () => {
  const tpl: ProviderTemplate = { version: 1, detail: { mode: "table", collection: "repos" } }

  it("returns the array found at detail.collection", () => {
    const ctx = ctxOf({ base: { repos: [{ n: 1 }, { n: 2 }] } })
    expect(resolveCollection(tpl, ctx)).toHaveLength(2)
  })

  it("empty array when there is no collection path or the value is not an array", () => {
    expect(resolveCollection({ version: 1, detail: { mode: "text" } }, ctxOf())).toEqual([])
    expect(resolveCollection(tpl, ctxOf({ base: { repos: "nope" } }))).toEqual([])
  })

  it("elementCtx rebinds base while keeping row / source / vars", () => {
    const ctx = ctxOf({ row: { r: 1 }, source: { s: 1 }, vars: { v: 1 } })
    const el = elementCtx(ctx, { x: 9 })
    expect(el.base).toEqual({ x: 9 })
    expect(el.row).toBe(ctx.row)
    expect(el.vars).toBe(ctx.vars)
    expect(resolveAccessor("x", el)).toBe(9)
  })
})

describe("usableEmbedUrl", () => {
  it("null / undefined / empty", () => {
    expect(usableEmbedUrl(null)).toBeNull()
    expect(usableEmbedUrl(undefined)).toBeNull()
    expect(usableEmbedUrl("")).toBeNull()
  })

  it("rejects non-http and identifier-less urls", () => {
    expect(usableEmbedUrl("ftp://x/embed/abcd")).toBeNull()
    expect(usableEmbedUrl("https://youtube.com/embed/")).toBeNull()
    expect(usableEmbedUrl("https://host/watch")).toBeNull()
  })

  it("accepts /embed/<id> and ?v=<id>", () => {
    expect(usableEmbedUrl("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    )
    expect(usableEmbedUrl("https://youtube.com/watch?v=dQw4w9WgXcQ")).toContain("v=dQw4")
  })
})

describe("resolveOpenUrl", () => {
  const withOpen: ProviderTemplate = { version: 1, detail: { openUrl: "$row.link" } }
  const withField: ProviderTemplate = { version: 1, item: { fields: { url: "$row.link" } } }

  it("prefers detail.openUrl, then fields.url", () => {
    expect(resolveOpenUrl(withOpen, { link: "https://a.test/x" }, undefined)).toBe(
      "https://a.test/x",
    )
    expect(resolveOpenUrl(withField, { link: "https://b.test/y" }, undefined)).toBe(
      "https://b.test/y",
    )
  })

  it("null for a non-URL, a non-http scheme or a //-path", () => {
    expect(resolveOpenUrl(withOpen, { link: "not a url" }, undefined)).toBeNull()
    expect(resolveOpenUrl(withOpen, { link: "mailto:x@y.z" }, undefined)).toBeNull()
    expect(resolveOpenUrl(withOpen, { link: "https://host//evil" }, undefined)).toBeNull()
    expect(resolveOpenUrl({ version: 1 }, {}, undefined)).toBeNull()
  })
})

describe("resolveIcon", () => {
  it("svg from paths[]", () => {
    expect(resolveIcon({ icon: { paths: ["M0 0"], viewBox: "0 0 10 10", stroke: true } })).toEqual({
      kind: "svg",
      paths: ["M0 0"],
      viewBox: "0 0 10 10",
      stroke: true,
    })
  })

  it("svg from a single `d`, default viewBox, stroke coerced to false", () => {
    expect(resolveIcon({ icon: { d: "M1 1" } })).toEqual({
      kind: "svg",
      paths: ["M1 1"],
      viewBox: "0 0 24 24",
      stroke: false,
    })
  })

  it("an object with neither paths nor d falls through to the named dot", () => {
    expect(resolveIcon({ icon: {} })).toEqual({ kind: "named", name: "dot" })
    expect(resolveIcon({ icon: { paths: [] } })).toEqual({ kind: "named", name: "dot" })
  })

  it("data: and http(s) strings → image", () => {
    expect(resolveIcon({ icon: "data:image/svg+xml,<svg/>" })).toEqual({
      kind: "image",
      src: "data:image/svg+xml,<svg/>",
    })
    expect(resolveIcon({ icon: "https://cdn.test/i.png" })).toEqual({
      kind: "image",
      src: "https://cdn.test/i.png",
    })
  })

  it("any other non-empty string → named key", () => {
    expect(resolveIcon({ icon: "youtube" })).toEqual({ kind: "named", name: "youtube" })
  })

  it("empty string / no icon / no display → named dot", () => {
    expect(resolveIcon({ icon: "" })).toEqual({ kind: "named", name: "dot" })
    expect(resolveIcon({})).toEqual({ kind: "named", name: "dot" })
    expect(resolveIcon(undefined)).toEqual({ kind: "named", name: "dot" })
  })
})

describe("stripScheme", () => {
  it("drops the scheme, www. and trailing slashes", () => {
    expect(stripScheme("https://www.example.com/path/")).toBe("example.com/path")
    expect(stripScheme("http://example.com///")).toBe("example.com")
    expect(stripScheme("example.com")).toBe("example.com")
  })
})

describe("resolveFeedLabel", () => {
  it("resolves display.feedLabel against the source", () => {
    const tpl: ProviderTemplate = {
      version: 1,
      display: { feedLabel: { path: "$source.url", format: "hostname" } },
    }
    expect(resolveFeedLabel(tpl, { url: "https://www.blog.test/feed" })).toBe("blog.test")
  })

  it("falls back to stripScheme(source.url) with no feedLabel or an empty one", () => {
    expect(resolveFeedLabel(null, { url: "https://site.test/x/" })).toBe("site.test/x")
    const tpl: ProviderTemplate = { version: 1, display: { feedLabel: "missing" } }
    expect(resolveFeedLabel(tpl, { url: "https://site.test/y" })).toBe("site.test/y")
    expect(resolveFeedLabel(undefined, {})).toBe("")
  })
})

describe("applyFormTransform", () => {
  it("no transform → trimmed", () => {
    expect(applyFormTransform("  x  ", undefined)).toBe("x")
  })

  it("trim:false keeps the surrounding whitespace", () => {
    expect(applyFormTransform("  x  ", { trim: false })).toBe("  x  ")
  })

  it("extract keeps capture group 1 when the regex matches", () => {
    expect(
      applyFormTransform("https://github.com/facebook/react", {
        extract: "github\\.com/([^/]+/[^/]+)",
      }),
    ).toBe("facebook/react")
  })

  it("extract is ignored when it does not match or is an invalid regex", () => {
    expect(applyFormTransform("nope", { extract: "(x)(?" })).toBe("nope")
    expect(applyFormTransform("nope", { extract: "(zzz)" })).toBe("nope")
  })

  it("stripPrefix / stripSuffix accept a string or a list", () => {
    expect(applyFormTransform("@fireship", { stripPrefix: "@" })).toBe("fireship")
    expect(applyFormTransform("repo.git/", { stripSuffix: [".git", "/"] })).toBe("repo.git")
  })
})

describe("buildFluxUrl", () => {
  it("keeps an already-absolute URL", () => {
    expect(buildFluxUrl({ urlTemplate: "https://x/{value}" }, "https://github.com/a/b")).toBe(
      "https://github.com/a/b",
    )
  })

  it("interpolates {value} into urlTemplate", () => {
    expect(buildFluxUrl({ urlTemplate: "https://github.com/{value}/" }, "facebook/react")).toBe(
      "https://github.com/facebook/react/",
    )
  })

  it("returns the bare transformed value with no urlTemplate", () => {
    expect(buildFluxUrl(undefined, "  hello  ")).toBe("hello")
    expect(buildFluxUrl({ transform: { trim: true } }, "abc")).toBe("abc")
  })

  it("applies the form transform before building the URL", () => {
    expect(
      buildFluxUrl(
        { urlTemplate: "https://www.youtube.com/@{value}", transform: { stripPrefix: ["@"] } },
        "@fireship",
      ),
    ).toBe("https://www.youtube.com/@fireship")
  })
})

describe("matchesFormPattern", () => {
  it("true when there is no pattern", () => {
    expect(matchesFormPattern(undefined, "anything")).toBe(true)
    expect(matchesFormPattern({}, "anything")).toBe(true)
  })

  it("tests the transformed input against the pattern", () => {
    const form = { pattern: "^https?://.+", transform: { trim: true } }
    expect(matchesFormPattern(form, "  https://a.test/feed  ")).toBe(true)
    expect(matchesFormPattern(form, "not-a-url")).toBe(false)
  })

  it("true when the pattern is an invalid regex", () => {
    expect(matchesFormPattern({ pattern: "(" }, "x")).toBe(true)
  })
})
