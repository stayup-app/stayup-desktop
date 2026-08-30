import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { ApiError, updateProfile } from "@/lib/api"
import { useLanguage } from "@/context/LanguageContext"
import type { Translations } from "@/lib/translations"

function makeSchema(t: Translations) {
  return z
    .object({
      // L'API exige le mot de passe actuel : un token seul ne doit pas suffire à
      // verrouiller le compte de son propriétaire.
      currentPassword: z.string().min(1, t.profile.currentPasswordRequired),
      newPassword: z.string().min(8, t.auth.passwordTooShort),
      confirmPassword: z.string(),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      message: t.auth.passwordMismatch,
      path: ["confirmPassword"],
    })
}

type FormValues = { currentPassword: string; newPassword: string; confirmPassword: string }

interface ChangePasswordFormProps {
  userId: string
  token: string
  apiUrl: string
}

export function ChangePasswordForm({ userId, token, apiUrl }: ChangePasswordFormProps) {
  const { t } = useLanguage()
  const schema = useMemo(() => makeSchema(t), [t])
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormValues) {
    setError(null)
    setSuccess(false)
    try {
      if (!token) throw new Error(t.feed.tokenMissing)
      await updateProfile(userId, token, apiUrl, {
        password: data.newPassword,
        currentPassword: data.currentPassword,
      })
      setSuccess(true)
      reset()
    } catch (err) {
      // Le message de l'API est en anglais : on traduit depuis le statut.
      if (err instanceof ApiError && err.status === 401) {
        setError(t.errors.wrongCurrentPassword)
      } else if (err instanceof ApiError && err.status === 409) {
        setError(t.errors.emailTaken)
      } else {
        // Les erreurs de l'API sont toutes des ApiError : ce qui reste vient de
        // l'app elle-même (token manquant) et porte déjà un message traduit.
        setError(err instanceof Error ? err.message : t.common.error)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="current-password" className="text-sm font-medium">
          {t.profile.currentPassword}
        </label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("currentPassword")}
        />
        {errors.currentPassword && (
          <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="new-password" className="text-sm font-medium">
          {t.profile.newPassword}
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("newPassword")}
        />
        {errors.newPassword && (
          <p className="text-xs text-destructive">{errors.newPassword.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="confirm-password" className="text-sm font-medium">
          {t.profile.confirmNewPassword}
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && (
        <p className="text-xs" style={{ color: "var(--sage)" }}>
          {t.profile.passwordUpdated}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-9 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {isSubmitting ? t.profile.updatingPassword : t.profile.updatePassword}
      </button>
    </form>
  )
}
