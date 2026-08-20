import { useState } from "react"
import { LoginForm } from "./LoginForm"
import { RegisterForm } from "./RegisterForm"
import { OAuthButtons } from "./OAuthButtons"
import { useLanguage } from "@/context/LanguageContext"

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
        background: "hsl(var(--background))",
        backgroundImage:
          "radial-gradient(ellipse 60% 50% at 50% 0%, oklch(0.72 0.22 195 / 0.06), transparent)",
      }}
    >
      <div className="flex flex-col items-center">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <svg width="32" height="32" viewBox="0 0 26 26" fill="none">
            <rect width="26" height="26" rx="6" fill="var(--teal)" />
            <path d="M13 6L19.5 15H15V20H11V15H6.5L13 6Z" fill="#09090b" />
          </svg>
          <span className="font-semibold text-[17px]" style={{ letterSpacing: "-0.02em" }}>
            StayUp
          </span>
        </div>

        {/* Card */}
        <div
          className="w-[380px] rounded-[14px] p-8"
          style={{
            background: "var(--surface)",
            border: "1px solid hsl(var(--border))",
            boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
          }}
        >
          <div className="text-center mb-6">
            <h1 className="text-[20px] font-bold mb-1" style={{ letterSpacing: "-0.02em" }}>
              {mode === "login" ? t.auth.signIn : t.auth.signUp}
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
