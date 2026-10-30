import { useState, type ReactNode } from 'react'

const storeKey = (ideaId: string, id: string) => `ideos:fold:${ideaId}:${id}`

function read(k: string): boolean | null {
  try {
    const v = localStorage.getItem(k)
    return v == null ? null : v === '1'
  } catch {
    return null
  }
}
function write(k: string, open: boolean) {
  try {
    localStorage.setItem(k, open ? '1' : '0')
  } catch {
    /* không lưu được thì lần sau mở theo mặc định */
  }
}

export const isWide = () => typeof matchMedia === 'function' && matchMedia('(min-width: 1024px)').matches

/**
 * Một mục của trang ý tưởng, thu gọn được. Trên điện thoại mọi mục đóng sẵn (tiêu đề mục đã có số liệu tóm tắt)
 * để trang khỏi dài cả chục màn hình; trên màn rộng mọi mục mở. Mở hay đóng thì nhớ riêng cho từng ý tưởng.
 */
export function Fold({ ideaId, id, headingId, title, meta, children }: { ideaId: string; id: string; headingId?: string; title: string; meta?: ReactNode; children: ReactNode }) {
  const k = storeKey(ideaId, id)
  const [open, setOpen] = useState(() => read(k) ?? isWide())
  return (
    <details
      id={'sec-' + id}
      className="block fold"
      open={open}
      onToggle={(e) => {
        const o = e.currentTarget.open
        setOpen(o)
        write(k, o)
      }}
    >
      <summary className="block-head">
        <h2 id={headingId}>{title}</h2>
        {meta}
      </summary>
      {children}
    </details>
  )
}

export interface JumpTarget {
  id: string
  label: string
}

/** Thanh nhảy nhanh tới từng mục (chỉ hiện trên điện thoại): mở mục rồi cuộn tới. */
export function JumpNav({ targets }: { targets: JumpTarget[] }) {
  const go = (id: string) => {
    const el = document.getElementById('sec-' + id) as HTMLDetailsElement | null
    if (!el) return
    el.open = true
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' })
  }
  return (
    <nav className="jump-nav" aria-label="Nhảy tới mục">
      {targets.map((t) => (
        <button key={t.id} type="button" onClick={() => go(t.id)}>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
