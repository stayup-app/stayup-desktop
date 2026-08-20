import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useLanguage } from "@/context/LanguageContext"
import type { Translations } from "@/lib/translations"

function makeSchema(t: Translations) {
  return z.object({
    name: z.string().min(1, t.auth.nameRequired),
    email: z.string().email(t.auth.emailInvalid),
    password: z.string().min(8, t.auth.passwordTooShort),
  })
}

type FormValues = { name: string; email: string; password: string }

interface RegisterFormProps {
  onSubmit: (name: string, email: string, password: string) => Promise<void>
  loading: boolean
  error: string | null
}

export function RegisterForm({ onSubmit, loading, error }: RegisterFormProps) {
  const { t } = useLanguage()
  const schema = useMemo(() => makeSchema(t), [t])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  return (
    <form
      onSubmit={handleSubmit((v) => onSubmit(v.name, v.email, v.password))}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          {t.auth.name}
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          placeholder={t.auth.namePlaceholder}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("name")}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="register-email" className="text-sm font-medium">
          {t.auth.email}
        </label>
        <input
          id="register-email"
          type="email"
          autoComplete="email"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("email")}
        />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="register-password" className="text-sm font-medium">
          {t.auth.password}
        </label>
        <input
          id="register-password"
          type="password"
          autoComplete="new-password"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...register("password")}
        />
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
      >
        {loading ? t.auth.signingUp : t.auth.signUp}
      </button>
    </form>
  )
}
