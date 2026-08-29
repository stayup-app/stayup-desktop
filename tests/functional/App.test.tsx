import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import App from "@/App"
import { LanguageProvider } from "@/context/LanguageContext"
import { ThemeProvider } from "@/context/ThemeContext"
import { fr } from "@/lib/translations/fr"
import { useAuth } from "@/hooks/useAuth"
import { useUpdater } from "@/hooks/useUpdater"

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }))
vi.mock("@/hooks/useUpdater", () => ({ useUpdater: vi.fn() }))
vi.mock("@/hooks/useMenu", () => ({ useMenu: vi.fn() }))
vi.mock("@/hooks/useFeed", () => ({
  useFeed: vi.fn().mockReturnValue({
    fluxes: [],
    connectors: { changelog: [], youtube: [], rss: [], scrap: [] },
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}))
vi.mock("@/lib/store", () => ({
  readToken: vi.fn().mockResolvedValue("jwt"),
  readApiUrl: vi.fn().mockResolvedValue("https://api.test"),
  readLang: vi.fn().mockResolvedValue(null),
  writeLang: vi.fn().mockResolvedValue(undefined),
  readReadItems: vi.fn().mockResolvedValue([]),
  writeReadItems: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@/lib/api", () => ({
  deleteUserRepository: vi.fn(),
  addUserRepository: vi.fn(),
  createScrapRequest: vi.fn(),
  getScrapRepos: vi.fn().mockResolvedValue([]),
  subscribeScrap: vi.fn(),
  fetchAuthConfig: vi.fn().mockResolvedValue(null),
}))

const session = { userId: "alice", name: "Alice", email: "alice@test.com", role: "user" }

type AuthState = ReturnType<typeof useAuth>
type UpdaterState = ReturnType<typeof useUpdater>

function mockAuth(overrides: Partial<AuthState> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    session: null,
    loading: false,
    error: null,
    login: vi.fn(),
    loginOAuth: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  } as AuthState)
}

function mockUpdater(overrides: Partial<UpdaterState> = {}) {
  vi.mocked(useUpdater).mockReturnValue({
    status: "idle",
    downloadProgress: null,
    checkForUpdates: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  } as UpdaterState)
}

function renderApp() {
  return render(
    <LanguageProvider initialLang="fr">
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </LanguageProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth()
  mockUpdater()
})

describe("App", () => {
  it("shows a splash screen while the session is being restored", () => {
    mockAuth({ loading: true })
    renderApp()
    expect(screen.getByText(fr.feed.loading)).toBeInTheDocument()
  })

  it("shows the login modal when signed out", () => {
    renderApp()
    expect(screen.getByText(fr.auth.subtitle)).toBeInTheDocument()
  })

  it("forwards the auth error to the login modal", () => {
    mockAuth({ error: "Identifiants invalides." })
    renderApp()
    expect(screen.getByText("Identifiants invalides.")).toBeInTheDocument()
  })

  it("shows the feed once signed in", () => {
    mockAuth({ session })
    renderApp()
    expect(screen.getByText(fr.feed.allFeeds)).toBeInTheDocument()
    expect(screen.queryByText(fr.auth.subtitle)).not.toBeInTheDocument()
  })

  it("hides the update banner when idle", () => {
    mockAuth({ session })
    renderApp()
    expect(screen.queryByText(fr.updater.checking)).not.toBeInTheDocument()
  })

  it("shows the update banner and dismisses it", () => {
    const dismiss = vi.fn()
    mockAuth({ session })
    mockUpdater({ status: "up-to-date", dismiss })
    renderApp()

    expect(screen.getByText(fr.updater.upToDate)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "✕" }))
    expect(dismiss).toHaveBeenCalled()
  })
})
