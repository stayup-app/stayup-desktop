import { useState } from "react"
import { LoginForm } from "./LoginForm"
import { RegisterForm } from "./RegisterForm"
import { OAuthButtons } from "./OAuthButtons"
import { useLanguage } from "@/context/LanguageContext"
import { AuroraMark } from "@/components/ui/AuroraMark"

interface LoginModalProps {
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: (name: string, email: string, password: string) => Promise<void>
  onOAuth: (provider: "github" | "google") => Promise<void>
  loading: boolean
  error: string | null
}

export function LoginModal({ onLogin, onRegister, onOAuth, loading, error }: LoginModalProps) {
  const { t } = useLanguage()
  const [mode, setMode] = useState<"login" | "register">("login")

  return (
    <div
      className="flex items-center justify-center h-screen"
      style={{
        background: "var(--bg)",
        backgroundImage:
          "radial-gradient(ellipse 60% 50% at 50% 0%, var(--peach-dim), transparent), radial-gradient(ellipse 50% 40% at 10% 20%, var(--lavender-dim), transparent)",
      }}
    >
      <div className="flex flex-col items-center">
        {/* Logo */}
        <div className="mb-8">
          <AuroraMark size={56} />
        </div>

        {/* Card */}
        <div
          className="w-[380px] rounded-[14px] p-8"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-color)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
          }}
        >
          <div className="text-center mb-6">
            <h1 className="font-serif text-[28px] leading-[1.15] tracking-editorial font-normal mb-1.5">
              {mode === "login" ? t.auth.loginTitle : t.auth.registerTitle}
            </h1>
            {mode === "login" && (
              <p className="text-[13px] text-muted-foreground">{t.auth.subtitle}</p>
            )}
          </div>

          <div className="mb-5">
            <OAuthButtons onOAuth={onOAuth} loading={loading} />
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: "hsl(var(--border))" }} />
            <span className="text-[11px] text-muted-foreground">{t.auth.or}</span>
            <div className="flex-1 h-px" style={{ background: "hsl(var(--border))" }} />
          </div>

          {mode === "login" ? (
            <LoginForm onSubmit={onLogin} loading={loading} error={error} />
          ) : (
            <RegisterForm onSubmit={onRegister} loading={loading} error={error} />
          )}

          <p className="mt-5 text-center text-[13px] text-muted-foreground">
            {mode === "login" ? t.auth.noAccount : t.auth.alreadyHaveAccount}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="font-medium text-foreground hover:underline"
            >
              {mode === "login" ? t.auth.signUp : t.auth.signIn}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
