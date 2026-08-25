interface AuroraMarkProps {
  size?: number
  className?: string
}

export function AuroraMark({ size = 28, className }: AuroraMarkProps) {
  const id = `aurora-${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
      <defs>
        <radialGradient id={id} cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="#FFD4A8" />
          <stop offset="55%" stopColor="var(--peach)" />
          <stop offset="100%" stopColor="#D88A52" />
        </radialGradient>
        <linearGradient id={`${id}-h`} x1="0" y1="0" x2="32" y2="0">
          <stop offset="0%" stopColor="var(--peach)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--peach)" stopOpacity="0.65" />
          <stop offset="100%" stopColor="var(--peach)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle
        cx="16"
        cy="16"
        r="14"
        fill="var(--surface)"
        stroke="var(--border-color)"
        strokeWidth="0.5"
      />
      <circle cx="16" cy="19" r="7.5" fill={`url(#${id})`} />
      <rect x="3" y="20.5" width="26" height="0.8" fill={`url(#${id}-h)`} />
    </svg>
  )
}

interface AuroraWordmarkProps {
  size?: number
  className?: string
}

export function AuroraWordmark({ size = 15, className }: AuroraWordmarkProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <AuroraMark size={size + 12} />
      <span style={{ fontSize: size, fontWeight: 600, letterSpacing: "-0.015em" }}>stayup</span>
    </div>
  )
}
