/** Dấu hiệu của Ideos: chấm cam có một tia sáng. */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#ff6b3d" />
      <path
        d="M12 5c.8 4.2 2.8 6.2 7 7-4.2.8-6.2 2.8-7 7-.8-4.2-2.8-6.2-7-7 4.2-.8 6.2-2.8 7-7z"
        fill="#fbf6ea"
      />
    </svg>
  )
}
