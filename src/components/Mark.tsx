/** Dấu hiệu của Ideos: chữ "i" mà dấu chấm là một tia ý tưởng. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="7" fill="var(--text)" />
      <rect x="10" y="10" width="4" height="9" rx="2" fill="var(--ground)" />
      <circle cx="12" cy="6.25" r="2.25" fill="var(--accent-on-ink)" />
    </svg>
  )
}
