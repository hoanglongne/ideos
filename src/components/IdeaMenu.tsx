import { Copy, MoreHorizontal, Pin, Share2, Trash2, Wand2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { KINDS, STATUSES, type Idea } from '../types'

/** Mọi thứ phụ của một ý tưởng nằm sau một nút ⋯: giai đoạn, loại, ghim, chia sẻ, nhân bản, xoá. */
export function IdeaMenu({
  idea,
  onStatus,
  onKind,
  onPin,
  onShare,
  onDuplicate,
  onRemove,
  coachHref,
}: {
  idea: Idea
  onStatus: (s: Idea['status']) => void
  onKind: (k: Idea['kind']) => void
  onPin: () => void
  onShare: () => void
  onDuplicate: () => void
  onRemove: () => void
  coachHref: string
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  // bấm ra ngoài hoặc Esc thì đóng
  useEffect(() => {
    const close = (e: Event) => {
      const d = ref.current
      if (!d?.open) return
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return
      if (e.type === 'pointerdown' && d.contains(e.target as Node)) return
      d.open = false
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [])
  const run = (fn: () => void) => () => {
    if (ref.current) ref.current.open = false
    fn()
  }
  return (
    <details className="menu" ref={ref}>
      <summary className="icon-btn" aria-label="Thêm tuỳ chọn" title="Thêm tuỳ chọn">
        <MoreHorizontal size={20} strokeWidth={1.8} />
      </summary>
      <div className="menu-pop" role="group" aria-label="Tuỳ chọn ý tưởng">
        <label className="menu-field">
          <span>Giai đoạn</span>
          <select value={idea.status} onChange={(e) => onStatus(e.target.value as Idea['status'])} aria-label="Giai đoạn">
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="menu-field">
          <span>Loại</span>
          <select value={idea.kind} onChange={(e) => onKind(e.target.value as Idea['kind'])} aria-label="Loại">
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <a className="menu-item" href={coachHref}>
          <Wand2 size={16} strokeWidth={1.7} aria-hidden /> Mài ý tưởng
        </a>
        <button className="menu-item" onClick={run(onPin)}>
          <Pin size={16} strokeWidth={1.7} aria-hidden /> {idea.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
        </button>
        <button className="menu-item" onClick={run(onShare)}>
          <Share2 size={16} strokeWidth={1.7} aria-hidden /> Chia sẻ / chép Markdown
        </button>
        <button className="menu-item" onClick={run(onDuplicate)}>
          <Copy size={16} strokeWidth={1.7} aria-hidden /> Nhân bản
        </button>
        <button className="menu-item danger" onClick={run(onRemove)}>
          <Trash2 size={16} strokeWidth={1.7} aria-hidden /> Xoá ý tưởng này
        </button>
      </div>
    </details>
  )
}
