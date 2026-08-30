import { useAuth } from "@/hooks/useAuth"
import { useUpdater } from "@/hooks/useUpdater"
import { useLanguage } from "@/context/LanguageContext"
import { LoginModal } from "@/components/auth/LoginModal"
import { FeedLayout } from "@/components/feed/FeedLayout"
import { UpdateBanner } from "@/components/ui/UpdateBanner"
import { AuroraMark } from "@/components/ui/AuroraMark"

export default function App() {
  const auth = useAuth()
  const { session, loading, error, login, register, loginOAuth } = auth
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
        style={{ background: "var(--bg)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <AuroraMark size={32} />
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
      <FeedLayout auth={auth} onCheckUpdates={checkForUpdates} />
    </div>
  )
}
