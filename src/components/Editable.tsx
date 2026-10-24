import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Ô nhập giữ state cục bộ khi đang gõ và lưu trễ (debounce),
 * tránh bị dữ liệu từ DB ghi đè con trỏ.
 */
export function EditableText({
  value,
  onSave,
  placeholder,
  className,
  multiline = true,
  delay = 400,
  ariaLabel,
}: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
  className?: string
  multiline?: boolean
  delay?: number
  ariaLabel?: string
}) {
  const [local, setLocal] = useState(value)
  const focused = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const ref = useRef<HTMLTextAreaElement>(null)
  const pending = useRef<string | null>(null)
  const saveRef = useRef(onSave)
  saveRef.current = onSave

  useEffect(() => {
    if (!focused.current) setLocal(value)
  }, [value])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [local])

  const flush = () => {
    clearTimeout(timer.current)
    if (pending.current !== null) {
      saveRef.current(pending.current)
      pending.current = null
    }
  }

  useEffect(() => flush, [])

  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={ariaLabel ?? placeholder}
      className={'editable ' + (className ?? '')}
      placeholder={placeholder}
      value={local}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false
        flush()
      }}
      onKeyDown={(e) => {
        if (!multiline && e.key === 'Enter') {
          e.preventDefault()
          ;(e.target as HTMLTextAreaElement).blur()
        }
      }}
      onChange={(e) => {
        const v = multiline ? e.target.value : e.target.value.replace(/\n/g, ' ')
        setLocal(v)
        pending.current = v
        clearTimeout(timer.current)
        timer.current = setTimeout(flush, delay)
      }}
    />
  )
}
