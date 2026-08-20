import { useAuth } from "@/hooks/useAuth"
import { useUpdater } from "@/hooks/useUpdater"
import { useLanguage } from "@/context/LanguageContext"
import { LoginModal } from "@/components/auth/LoginModal"
import { FeedLayout } from "@/components/feed/FeedLayout"
import { UpdateBanner } from "@/components/ui/UpdateBanner"

export default function App() {
  const { session, loading, error, login, register, loginOAuth, logout } = useAuth()
  const {
    status: updateStatus,
    downloadProgress,
    checkForUpdates,
    dismiss: dismissUpdate,
  } = useUpdater()
  const { t } = useLanguage()

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "hsl(var(--background))" }}
      >
        <div className="flex flex-col items-center gap-4">
          <svg width="32" height="32" viewBox="0 0 26 26" fill="none">
            <rect width="26" height="26" rx="6" fill="var(--teal)" />
            <path d="M13 6L19.5 15H15V20H11V15H6.5L13 6Z" fill="#09090b" />
          </svg>
          <p className="text-[13px] text-muted-foreground font-mono">{t.feed.loading}</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <LoginModal
        onLogin={login}
        onRegister={register}
        onOAuth={loginOAuth}
        loading={loading}
        error={error}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <UpdateBanner
        status={updateStatus}
        downloadProgress={downloadProgress}
        t={t}
        onDismiss={dismissUpdate}
      />
      <FeedLayout session={session} onLogout={logout} onCheckUpdates={checkForUpdates} />
    </div>
  )
}
