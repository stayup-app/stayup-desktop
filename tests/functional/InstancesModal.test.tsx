import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { InstancesModal } from "@/components/instances/InstancesModal"
import { LanguageProvider } from "@/context/LanguageContext"
import { fr } from "@/lib/translations/fr"
import { fetchAuthConfig } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchAuthConfig: vi.fn(),
}))
vi.mock("@/lib/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/store")>()),
  hostOf: (u: string) => {
    try {
      return new URL(u).host
    } catch {
      return u
    }
  },
}))

const primary = { id: "i1", url: "https://a.example.com", name: "Alpha", token: "jwt-a" }
const secondary = { id: "i2", url: "https://b.example.com", name: "Beta", token: "jwt-b" }

function makeAuth(over: Partial<ReturnType<typeof buildAuth>> = {}) {
  return { ...buildAuth(), ...over }
}
function buildAuth() {
  return {
    session: null,
    sessions: [] as { instanceId: string; expired: boolean }[],
    instances: [primary, secondary],
    loading: false,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    loginOAuth: vi.fn(),
    logout: vi.fn(),
    addInstance: vi.fn().mockResolvedValue(null),
    reconnectInstance: vi.fn().mockResolvedValue(null),
    removeInstance: vi.fn().mockResolvedValue(undefined),
    renameInstance: vi.fn().mockResolvedValue(undefined),
    setPrimary: vi.fn().mockResolvedValue(undefined),
  }
}

function renderModal(auth = makeAuth()) {
  const onClose = vi.fn()
  render(
    <LanguageProvider initialLang="fr">
      <InstancesModal open onClose={onClose} auth={auth as never} />
    </LanguageProvider>,
  )
  return { auth, onClose }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchAuthConfig).mockResolvedValue(null)
})

describe("InstancesModal", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <LanguageProvider initialLang="fr">
        <InstancesModal open={false} onClose={vi.fn()} auth={makeAuth() as never} />
      </LanguageProvider>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("lists instances and tags the first as primary", () => {
    renderModal()
    expect(screen.getByDisplayValue("Alpha")).toBeInTheDocument()
    expect(screen.getByDisplayValue("Beta")).toBeInTheDocument()
    expect(screen.getByText(fr.instances.primary)).toBeInTheDocument()
    expect(screen.getByText("a.example.com")).toBeInTheDocument()
  })

  it("renames an instance on blur when the value changed", () => {
    const { auth } = renderModal()
    const field = screen.getByDisplayValue("Beta")
    fireEvent.change(field, { target: { value: "Renamed" } })
    fireEvent.blur(field)
    expect(auth.renameInstance).toHaveBeenCalledWith("i2", "Renamed")
  })

  it("does not rename when the value is unchanged", () => {
    const { auth } = renderModal()
    const field = screen.getByDisplayValue("Beta")
    fireEvent.blur(field)
    expect(auth.renameInstance).not.toHaveBeenCalled()
  })

  it("promotes a secondary instance to primary", () => {
    const { auth } = renderModal()
    fireEvent.click(screen.getByText(fr.instances.makePrimary))
    expect(auth.setPrimary).toHaveBeenCalledWith("i2")
  })

  it("removes a secondary instance without confirmation", () => {
    const { auth } = renderModal()
    const removeButtons = screen.getAllByText(fr.instances.remove)
    fireEvent.click(removeButtons[1]) // Beta
    expect(auth.removeInstance).toHaveBeenCalledWith("i2")
  })

  it("asks to confirm before removing the primary and honours a cancel", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    const { auth } = renderModal()
    fireEvent.click(screen.getAllByText(fr.instances.remove)[0])
    expect(confirm).toHaveBeenCalledWith(fr.instances.removePrimaryWarning)
    expect(auth.removeInstance).not.toHaveBeenCalled()
    confirm.mockRestore()
  })

  it("removes the primary when the warning is accepted", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    const { auth } = renderModal()
    fireEvent.click(screen.getAllByText(fr.instances.remove)[0])
    expect(auth.removeInstance).toHaveBeenCalledWith("i1")
    confirm.mockRestore()
  })

  it("checks a URL then adds an instance with email + password", async () => {
    const { auth } = renderModal()
    fireEvent.click(screen.getByText(fr.instances.add))

    fireEvent.change(screen.getByPlaceholderText(fr.instances.urlPlaceholder), {
      target: { value: "https://c.example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: "→" }))

    await waitFor(() => expect(fetchAuthConfig).toHaveBeenCalledWith("https://c.example.com"))

    fireEvent.change(screen.getByLabelText(fr.auth.email), { target: { value: "u@x.io" } })
    fireEvent.change(screen.getByLabelText(fr.auth.password), { target: { value: "pw" } })
    fireEvent.click(screen.getByRole("button", { name: fr.auth.signIn }))

    await waitFor(() =>
      expect(auth.addInstance).toHaveBeenCalledWith("https://c.example.com", {
        kind: "password",
        email: "u@x.io",
        password: "pw",
      }),
    )
  })

  it("adds an instance through an OAuth provider", async () => {
    const { auth } = renderModal()
    fireEvent.click(screen.getByText(fr.instances.add))
    fireEvent.change(screen.getByPlaceholderText(fr.instances.urlPlaceholder), {
      target: { value: "https://c.example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: "→" }))
    await screen.findByText(fr.auth.continueWithGitHub)

    fireEvent.click(screen.getByText(fr.auth.continueWithGitHub))

    await waitFor(() =>
      expect(auth.addInstance).toHaveBeenCalledWith("https://c.example.com", {
        kind: "oauth",
        provider: "github",
      }),
    )
  })

  it("reconnects an expired instance through OAuth", async () => {
    const auth = makeAuth({ sessions: [{ instanceId: "i2", expired: true }] })
    renderModal(auth)
    fireEvent.click(screen.getByText(fr.instances.reconnect))
    fireEvent.click(screen.getByText(fr.auth.continueWithGoogle))

    await waitFor(() =>
      expect(auth.reconnectInstance).toHaveBeenCalledWith("i2", {
        kind: "oauth",
        provider: "google",
      }),
    )
  })

  it("toggles the reconnect form closed on a second click", () => {
    const auth = makeAuth({ sessions: [{ instanceId: "i2", expired: true }] })
    renderModal(auth)
    fireEvent.click(screen.getByText(fr.instances.reconnect))
    expect(screen.getByLabelText(fr.auth.email)).toBeInTheDocument()
    fireEvent.click(screen.getByText(fr.instances.reconnect))
    expect(screen.queryByLabelText(fr.auth.email)).not.toBeInTheDocument()
  })

  it("surfaces an add error and keeps the form open", async () => {
    const auth = makeAuth({ addInstance: vi.fn().mockResolvedValue("Nope") })
    renderModal(auth)
    fireEvent.click(screen.getByText(fr.instances.add))
    fireEvent.change(screen.getByPlaceholderText(fr.instances.urlPlaceholder), {
      target: { value: "https://c.example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: "→" }))
    await screen.findByLabelText(fr.auth.email)

    fireEvent.change(screen.getByLabelText(fr.auth.email), { target: { value: "u@x.io" } })
    fireEvent.change(screen.getByLabelText(fr.auth.password), { target: { value: "pw" } })
    fireEvent.click(screen.getByRole("button", { name: fr.auth.signIn }))

    expect(await screen.findByText("Nope")).toBeInTheDocument()
  })

  it("offers a reconnect form for an expired session", async () => {
    const auth = makeAuth({ sessions: [{ instanceId: "i2", expired: true }] })
    renderModal(auth)

    expect(screen.getByText(fr.instances.expired)).toBeInTheDocument()
    fireEvent.click(screen.getByText(fr.instances.reconnect))

    fireEvent.change(screen.getByLabelText(fr.auth.email), { target: { value: "u@x.io" } })
    fireEvent.change(screen.getByLabelText(fr.auth.password), { target: { value: "pw" } })
    fireEvent.click(screen.getByRole("button", { name: fr.auth.signIn }))

    await waitFor(() =>
      expect(auth.reconnectInstance).toHaveBeenCalledWith("i2", {
        kind: "password",
        email: "u@x.io",
        password: "pw",
      }),
    )
  })

  it("closes from the close button and the backdrop", () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByText(fr.common.close))
    fireEvent.click(screen.getByTestId("dialog-backdrop"))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it("cancels the add form", () => {
    renderModal()
    fireEvent.click(screen.getByText(fr.instances.add))
    fireEvent.click(screen.getByText(fr.instances.cancel))
    expect(screen.queryByPlaceholderText(fr.instances.urlPlaceholder)).not.toBeInTheDocument()
  })
})
