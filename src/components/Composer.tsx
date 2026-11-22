import { useCallback, useEffect, useRef, useState } from 'react'
import { db, newIdea, updateIdea } from '../db'
import { getLocation } from '../lib/media'
import { go } from '../lib/router'
import { getSettings } from '../lib/settings'
import { parseCapture, uid } from '../lib/util'
import { AttachmentList, type PendingAttachment } from './Attachments'
import { MediaTools } from './MediaTools'
import { useToast } from './Toast'

const DRAFT_KEY = 'ideos.draft'
const readDraft = () => {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? ''
  } catch {
    return ''
  }
}
const writeDraft = (v: string) => {
  try {
    if (v) localStorage.setItem(DRAFT_KEY, v)
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* bỏ qua */
  }
}

/** Ô ghi nhanh nằm ngay trên trang chủ: gõ hoặc nói là lưu được, không cần mở gì thêm. */
export function Composer({ initialText, autoFocus }: { initialText?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(() => initialText || readDraft())
  const [atts, setAtts] = useState<PendingAttachment[]>([])
  const [interim, setInterim] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const toast = useToast()

  const grow = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 360) + 'px'
  }
  useEffect(grow, [text])
  useEffect(() => writeDraft(text), [text])
  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])
  // phím tắt N ở nơi khác kéo về trang chủ rồi gọi ô này
  useEffect(() => {
    const focus = () => {
      ref.current?.focus()
      ref.current?.scrollIntoView({ block: 'center' })
    }
    window.addEventListener('ideos:focus-composer', focus)
    return () => window.removeEventListener('ideos:focus-composer', focus)
  }, [])

  const parsed = parseCapture(text)
  const canSave = !!parsed.title || atts.length > 0

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const p = parseCapture(text)
    const idea = newIdea({
      title: p.title || (atts[0]?.type === 'audio' ? 'Ghi âm ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Ý tưởng chưa đặt tên'),
      body: p.body,
      tags: p.tags,
      kind: p.kind ?? 'other',
    })
    await db.transaction('rw', db.ideas, db.attachments, async () => {
      await db.ideas.add(idea)
      await db.attachments.bulkAdd(atts.map((a) => ({ ...a, id: uid(), ideaId: idea.id, createdAt: Date.now() })))
    })
    if (getSettings().geotag) getLocation().then((loc) => loc && updateIdea(idea.id, { location: loc }))
    setText('')
    setAtts([])
    writeDraft('')
    setSaving(false)
    toast('Đã lưu ý tưởng', { label: 'Mở', run: () => go('/idea/' + idea.id) })
  }

  const appendText = useCallback((t: string) => setText((cur) => (cur && !/\s$/.test(cur) ? cur + ' ' : cur) + t), [])

  return (
    <section className="composer" aria-label="Ghi ý tưởng mới">
      <textarea
        id="composer"
        ref={ref}
        className="capture-input"
        rows={2}
        placeholder="Vừa nghĩ ra gì?"
        aria-label="Nội dung ý tưởng"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            save()
          }
        }}
      />
      {interim && <div className="interim">{interim}</div>}
      <AttachmentList items={atts} onRemove={(i) => setAtts((xs) => xs.filter((_, j) => j !== i))} />
      <div className="composer-foot">
        <MediaTools onText={appendText} onInterim={setInterim} onAttach={(a) => setAtts((xs) => [...xs, a])} />
        <button className="btn primary" disabled={!canSave || saving} onClick={save} title="Ctrl + Enter">
          Lưu
        </button>
      </div>
    </section>
  )
}
