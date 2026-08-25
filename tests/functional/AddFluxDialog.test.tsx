import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AddFluxDialog } from "@/components/feed/AddFluxDialog"
import { LanguageProvider } from "@/context/LanguageContext"
import { fr } from "@/lib/translations/fr"
import { addUserRepository, createScrapRequest, getScrapRepos, subscribeScrap } from "@/lib/api"
import { readToken, readApiUrl } from "@/lib/store"

vi.mock("@/lib/api", () => ({
  addUserRepository: vi.fn().mockResolvedValue(undefined),
  createScrapRequest: vi.fn().mockResolvedValue({ id: "req-1" }),
  getScrapRepos: vi.fn(),
  subscribeScrap: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/store", () => ({
  readToken: vi.fn(),
  readApiUrl: vi.fn().mockResolvedValue("https://api.test"),
  readLang: vi.fn().mockResolvedValue(null),
  writeLang: vi.fn().mockResolvedValue(undefined),
}))

const scrapRepos = [
  { id: 10, url: "https://free.example.com", config: {}, created_at: "", is_subscribed: false },
  { id: 11, url: "https://taken.example.com", config: {}, created_at: "", is_subscribed: true },
]

function renderDialog(open = true) {
  const onClose = vi.fn()
  const onSuccess = vi.fn()
  const view = render(
    <LanguageProvider initialLang="fr">
      <AddFluxDialog open={open} onClose={onClose} userId="user-1" onSuccess={onSuccess} />
    </LanguageProvider>,
  )
  return { ...view, onClose, onSuccess }
}

const PROVIDER_LABELS: Record<string, string> = {
  changelog: "GitHub",
  youtube: "YouTube",
  rss: "RSS",
  scrap: "Web",
}

function selectProvider(value: string) {
  fireEvent.click(screen.getByRole("button", { name: PROVIDER_LABELS[value] }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(readToken).mockResolvedValue("jwt")
  vi.mocked(readApiUrl).mockResolvedValue("https://api.test")
  vi.mocked(getScrapRepos).mockResolvedValue(scrapRepos)
})

describe("visibility", () => {
  it("renders nothing when closed", () => {
    const { container } = renderDialog(false)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders the dialog title when open", () => {
    renderDialog()
    expect(screen.getByText(fr.addFlux.title)).toBeInTheDocument()
  })

  it("offers exactly the four supported providers", () => {
    renderDialog()
    for (const label of Object.values(PROVIDER_LABELS)) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
  })

  it("closes and resets on cancel", () => {
    const { onClose } = renderDialog()
    fireEvent.click(screen.getByText(fr.addFlux.cancel))
    expect(onClose).toHaveBeenCalled()
  })

  it("closes when the backdrop is clicked", () => {
    const { onClose } = renderDialog()
    fireEvent.click(screen.getByTestId("dialog-backdrop"))
    expect(onClose).toHaveBeenCalled()
  })
})

describe("identifier-based providers", () => {
  it("normalizes a GitHub identifier and adds the repository", async () => {
    const { onSuccess, onClose } = renderDialog()

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "https://github.com/facebook/react.git" },
    })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    await waitFor(() =>
      expect(addUserRepository).toHaveBeenCalledWith("user-1", "jwt", "https://api.test", {
        provider: "changelog",
        url: "https://github.com/facebook/react/",
        config: { max_scraps: 5, retention_days: 15 },
      }),
    )
    expect(onSuccess).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it("normalizes a YouTube handle", async () => {
    renderDialog()
    selectProvider("youtube")

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "@fireship" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    await waitFor(() =>
      expect(addUserRepository).toHaveBeenCalledWith(
        "user-1",
        "jwt",
        "https://api.test",
        expect.objectContaining({ url: "https://www.youtube.com/@fireship" }),
      ),
    )
  })

  it("shows the per-provider label and placeholder", () => {
    renderDialog()
    selectProvider("rss")
    expect(screen.getByText(fr.addFlux.identifierLabels.rss)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(fr.addFlux.placeholders.rss)).toBeInTheDocument()
  })

  it("rejects an empty identifier", async () => {
    renderDialog()
    fireEvent.click(screen.getByText(fr.addFlux.add))

    expect(await screen.findByText(fr.addFlux.requiredError)).toBeInTheDocument()
    expect(addUserRepository).not.toHaveBeenCalled()
  })

  it("reports a missing token", async () => {
    vi.mocked(readToken).mockResolvedValue(null)
    renderDialog()

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "facebook/react" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    expect(await screen.findByText(fr.feed.tokenMissing)).toBeInTheDocument()
  })

  it("surfaces the API error message", async () => {
    vi.mocked(addUserRepository).mockRejectedValue(new Error("StayUp API error 409"))
    renderDialog()

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "facebook/react" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    expect(await screen.findByText("StayUp API error 409")).toBeInTheDocument()
  })

  it("falls back to a generic message for a non-Error rejection", async () => {
    vi.mocked(addUserRepository).mockRejectedValue("boom")
    renderDialog()

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "facebook/react" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    expect(await screen.findByText(fr.common.error)).toBeInTheDocument()
  })
})

describe("scrap provider — choose existing", () => {
  it("lists only repositories the user is not subscribed to", async () => {
    renderDialog()
    selectProvider("scrap")

    await waitFor(() => expect(getScrapRepos).toHaveBeenCalled())
    expect(await screen.findByText("https://free.example.com")).toBeInTheDocument()
    expect(screen.queryByText("https://taken.example.com")).not.toBeInTheDocument()
  })

  it("shows a loading hint before the list arrives", () => {
    renderDialog()
    selectProvider("scrap")
    expect(screen.getByText(fr.addFlux.loading)).toBeInTheDocument()
  })

  it("shows an empty-state option when nothing is available", async () => {
    vi.mocked(getScrapRepos).mockResolvedValue([])
    renderDialog()
    selectProvider("scrap")

    expect(await screen.findByText(fr.addFlux.noScrapRepos)).toBeInTheDocument()
  })

  it("treats a fetch failure as an empty list", async () => {
    vi.mocked(getScrapRepos).mockRejectedValue(new Error("offline"))
    renderDialog()
    selectProvider("scrap")

    expect(await screen.findByText(fr.addFlux.noScrapRepos)).toBeInTheDocument()
  })

  it("treats a missing token as an empty list", async () => {
    vi.mocked(readToken).mockResolvedValue(null)
    renderDialog()
    selectProvider("scrap")

    expect(await screen.findByText(fr.addFlux.noScrapRepos)).toBeInTheDocument()
    expect(getScrapRepos).not.toHaveBeenCalled()
  })

  it("subscribes to the selected repository", async () => {
    const { onSuccess } = renderDialog()
    selectProvider("scrap")
    await screen.findByText("https://free.example.com")

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "10" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    await waitFor(() => expect(subscribeScrap).toHaveBeenCalledWith(10, "jwt", "https://api.test"))
    expect(onSuccess).toHaveBeenCalled()
  })

  it("rejects an empty selection", async () => {
    renderDialog()
    selectProvider("scrap")
    await screen.findByText("https://free.example.com")

    fireEvent.click(screen.getByText(fr.addFlux.add))

    expect(await screen.findByText(fr.addFlux.selectError)).toBeInTheDocument()
    expect(subscribeScrap).not.toHaveBeenCalled()
  })
})

describe("scrap provider — request mode", () => {
  async function openRequestMode() {
    renderDialog()
    selectProvider("scrap")
    await screen.findByText("https://free.example.com")
    fireEvent.click(screen.getByText(fr.addFlux.makeRequest))
  }

  it("submits a scrap request and shows the confirmation", async () => {
    await openRequestMode()

    fireEvent.change(screen.getByPlaceholderText(fr.addFlux.requestUrlPlaceholder), {
      target: { value: "https://blog.dev" },
    })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    await waitFor(() =>
      expect(createScrapRequest).toHaveBeenCalledWith(
        { url: "https://blog.dev" },
        "jwt",
        "https://api.test",
      ),
    )
    expect(await screen.findByText(fr.addFlux.requestSent)).toBeInTheDocument()
    expect(screen.getByText(fr.addFlux.close)).toBeInTheDocument()
  })

  it("rejects an empty URL", async () => {
    await openRequestMode()
    fireEvent.click(screen.getByText(fr.addFlux.add))

    expect(await screen.findByText(fr.addFlux.requiredError)).toBeInTheDocument()
    expect(createScrapRequest).not.toHaveBeenCalled()
  })

  it("rejects a malformed URL", async () => {
    await openRequestMode()

    const input = screen.getByPlaceholderText(fr.addFlux.requestUrlPlaceholder)
    fireEvent.change(input, { target: { value: "not-a-url" } })
    // Submit the form directly: a click would be stopped by the browser's own
    // constraint validation on the type="url" input before handleSubmit runs.
    fireEvent.submit(input.closest("form")!)

    expect(await screen.findByText(fr.addFlux.requestUrlError)).toBeInTheDocument()
    expect(createScrapRequest).not.toHaveBeenCalled()
  })

  it("reports a missing token", async () => {
    await openRequestMode()
    vi.mocked(readToken).mockResolvedValue(null)

    fireEvent.change(screen.getByPlaceholderText(fr.addFlux.requestUrlPlaceholder), {
      target: { value: "https://blog.dev" },
    })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    expect(await screen.findByText(fr.feed.tokenMissing)).toBeInTheDocument()
  })

  it("surfaces a request failure", async () => {
    vi.mocked(createScrapRequest).mockRejectedValue(new Error("rejected"))
    await openRequestMode()

    fireEvent.change(screen.getByPlaceholderText(fr.addFlux.requestUrlPlaceholder), {
      target: { value: "https://blog.dev" },
    })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    expect(await screen.findByText("rejected")).toBeInTheDocument()
  })

  it("switches back to the select mode", async () => {
    await openRequestMode()
    fireEvent.click(screen.getByText(fr.addFlux.chooseExisting))
    expect(screen.getByText(fr.addFlux.scrapRepo)).toBeInTheDocument()
  })
})

describe("edge cases", () => {
  it("treats an undefined repository list as empty", async () => {
    vi.mocked(getScrapRepos).mockResolvedValue(undefined as unknown as typeof scrapRepos)
    renderDialog()
    selectProvider("scrap")

    expect(await screen.findByText(fr.addFlux.noScrapRepos)).toBeInTheDocument()
  })

  it("falls back to a generic message when a scrap request fails with a non-Error", async () => {
    vi.mocked(createScrapRequest).mockRejectedValue("boom")
    renderDialog()
    selectProvider("scrap")
    await screen.findByText("https://free.example.com")
    fireEvent.click(screen.getByText(fr.addFlux.makeRequest))

    fireEvent.change(screen.getByPlaceholderText(fr.addFlux.requestUrlPlaceholder), {
      target: { value: "https://blog.dev" },
    })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    expect(await screen.findByText(fr.common.error)).toBeInTheDocument()
  })

  it("falls back to a generic message when a scrap subscription fails with a non-Error", async () => {
    vi.mocked(subscribeScrap).mockRejectedValue("boom")
    renderDialog()
    selectProvider("scrap")
    await screen.findByText("https://free.example.com")

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "10" } })
    fireEvent.click(screen.getByText(fr.addFlux.add))

    expect(await screen.findByText(fr.common.error)).toBeInTheDocument()
  })
})
