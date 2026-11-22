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

/** Mở một mục của trang ý tưởng rồi cuộn tới nó. */
export function openSection(id: string) {
  const el = document.getElementById('sec-' + id) as HTMLDetailsElement | null
  if (!el) return
  el.open = true
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' })
}

/**
 * Một mục của trang ý tưởng, thu gọn được. Mặc định đóng, trừ mục đang cần cho bước tiếp theo (`defaultOpen`);
 * tiêu đề mục đã có số liệu tóm tắt nên không cần mở để biết bên trong có gì. Mở hay đóng thì nhớ riêng cho từng ý tưởng.
 */
export function Fold({ ideaId, id, headingId, title, meta, defaultOpen = false, children }: { ideaId: string; id: string; headingId?: string; title: string; meta?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const k = storeKey(ideaId, id)
  const [open, setOpen] = useState(() => read(k) ?? defaultOpen)
  return (
    <details
      id={'sec-' + id}
      className="part"
      open={open}
      onToggle={(e) => {
        const o = e.currentTarget.open
        setOpen(o)
        write(k, o)
      }}
    >
      <summary>
        <h2 id={headingId}>{title}</h2>
        {meta && <span className="part-meta">{meta}</span>}
      </summary>
      <div className="part-body">{children}</div>
    </details>
  )
}
