import type { Config } from "tailwindcss"

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",

        // ─── Aurora canonical accents ───────────────────────
        peach: { DEFAULT: "var(--peach)", dim: "var(--peach-dim)" },
        lavender: { DEFAULT: "var(--lavender)", dim: "var(--lavender-dim)" },
        sage: { DEFAULT: "var(--sage)", dim: "var(--sage-dim)" },
        sky: { DEFAULT: "var(--sky)", dim: "var(--sky-dim)" },

        surface: "var(--surface)",
        "surface-hi": "var(--surface-hi)",
        "bg-soft": "var(--bg-soft)",
        "border-soft": "var(--border-soft)",
        "fg-soft": "var(--fg-soft)",
        dim: "var(--dim)",
      },

      fontFamily: {
        sans: ["Instrument Sans", "system-ui", "sans-serif"],
        serif: ["Instrument Serif", "Georgia", "serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },

      letterSpacing: {
        tightest: "-0.024em",
        display: "-0.02em",
        editorial: "-0.015em",
        micro: "0.14em",
        "micro-loose": "0.18em",
      },

      boxShadow: {
        card: "0 12px 40px rgba(0,0,0,0.4)",
        menu: "0 20px 60px rgba(0,0,0,0.5)",
        modal: "0 30px 80px rgba(0,0,0,0.6)",
        "peach-ring": "0 0 0 3px rgba(244, 181, 133, 0.18)",
      },

      keyframes: {
        "aurora-pop": {
          from: { opacity: "0", transform: "scale(.96) translateY(8px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "aurora-fade": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "aurora-slide-in": {
          from: { opacity: "0", transform: "translateX(6px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "aurora-shimmer": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.25" },
        },
        "aurora-spin": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "aurora-pop": "aurora-pop 180ms cubic-bezier(0.2,0.7,0.3,1)",
        "aurora-fade": "aurora-fade 150ms ease",
        "aurora-slide-in": "aurora-slide-in 200ms ease",
        "aurora-shimmer": "aurora-shimmer 1.4s ease-in-out infinite",
        "aurora-spin": "aurora-spin 900ms linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config
