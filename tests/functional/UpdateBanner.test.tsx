import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { UpdateBanner } from "@/components/ui/UpdateBanner"
import { fr } from "@/lib/translations/fr"
import type { UpdateStatus } from "@/hooks/useUpdater"

function renderBanner(status: UpdateStatus, downloadProgress: number | null = null) {
  const onDismiss = vi.fn()
  const view = render(
    <UpdateBanner
      status={status}
      downloadProgress={downloadProgress}
      t={fr}
      onDismiss={onDismiss}
    />,
  )
  return { ...view, onDismiss }
}

describe("UpdateBanner", () => {
  it("renders nothing when idle", () => {
    const { container } = renderBanner("idle")
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the checking message", () => {
    renderBanner("checking")
    expect(screen.getByText(fr.updater.checking)).toBeInTheDocument()
  })

  it("shows the up-to-date message", () => {
    renderBanner("up-to-date")
    expect(screen.getByText(fr.updater.upToDate)).toBeInTheDocument()
  })

  it("shows the restarting message", () => {
    renderBanner("restarting")
    expect(screen.getByText(fr.updater.restarting)).toBeInTheDocument()
  })

  it("shows the error message", () => {
    renderBanner("error")
    expect(screen.getByText(fr.updater.error)).toBeInTheDocument()
  })

  it("appends the percentage while downloading", () => {
    renderBanner("downloading", 42)
    expect(screen.getByText(`${fr.updater.downloading} 42%`)).toBeInTheDocument()
  })

  it("omits the percentage when progress is unknown", () => {
    renderBanner("downloading", null)
    expect(screen.getByText(fr.updater.downloading)).toBeInTheDocument()
  })

  it("renders a progress bar sized to the download progress", () => {
    renderBanner("downloading", 75)
    const bar = screen.getByTestId("update-progress-bar")
    expect(bar).not.toBeNull()
    expect(bar.style.width).toBe("75%")
  })

  it("renders no progress bar when progress is unknown", () => {
    renderBanner("downloading", null)
    expect(screen.queryByTestId("update-progress-bar")).toBeNull()
  })

  it.each(["up-to-date", "error"] as const)("is dismissible when %s", (status) => {
    const { onDismiss } = renderBanner(status)
    fireEvent.click(screen.getByRole("button"))
    expect(onDismiss).toHaveBeenCalled()
  })

  it.each(["checking", "downloading", "restarting"] as const)(
    "is not dismissible when %s",
    (status) => {
      renderBanner(status)
      expect(screen.queryByRole("button")).not.toBeInTheDocument()
    },
  )
})
