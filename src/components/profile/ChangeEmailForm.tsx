import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { updateProfile } from "@/lib/api"
import { readToken, readApiUrl } from "@/lib/store"
import { useLanguage } from "@/context/LanguageContext"
import type { Translations } from "@/lib/translations"

function makeSchema(t: Translations) {
  return z.object({
    email: z.string().email(t.auth.emailInvalid),
  })
}

type FormValues = { email: string }

interface ChangeEmailFormProps {
  userId: string
  currentEmail: string
}

export function ChangeEmailForm({ userId, currentEmail }: ChangeEmailFormProps) {
  const { t } = useLanguage()
  const schema = useMemo(() => makeSchema(t), [t])
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: currentEmail },
  })

  async function onSubmit(data: FormValues) {
    setError(null)
    setSuccess(false)
    try {
      const [token, apiUrl] = await Promise.all([readToken(), readApiUrl()])
      if (!token) throw new Error(t.feed.tokenMissing)
      await updateProfile(userId, token, apiUrl, { email: data.email })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="profile-email" className="text-sm font-medium">
          {t.profile.newEmail}
        </label>
        <input
          id="profile-email"
          type="email"
          autoComplete="email"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && (
        <p className="text-xs" style={{ color: "var(--sage)" }}>
          {t.profile.emailUpdated}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-9 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {isSubmitting ? t.profile.updatingEmail : t.profile.updateEmail}
      </button>
    </form>
  )
}
