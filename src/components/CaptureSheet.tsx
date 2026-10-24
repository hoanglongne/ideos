import { useCallback, useEffect, useRef, useState } from 'react'
import { db, newIdea, updateIdea } from '../db'
import { getLocation } from '../lib/media'
import { go } from '../lib/router'
import { getSettings } from '../lib/settings'
import { parseCapture, uid } from '../lib/util'
import { KINDS, type IdeaKind } from '../types'
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

export function CaptureSheet({ initialText, onClose }: { initialText?: string; onClose: () => void }) {
  const [text, setText] = useState(() => initialText || readDraft())
  const [kind, setKind] = useState<IdeaKind | null>(null)
  const [atts, setAtts] = useState<PendingAttachment[]>([])
  const [interim, setInterim] = useState('')
  const [saving, setSaving] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const toast = useToast()

  useEffect(() => {
    taRef.current?.focus()
    const el = taRef.current
    if (el) el.selectionStart = el.selectionEnd = el.value.length
  }, [])

  useEffect(() => writeDraft(text), [text])

  const parsed = parseCapture(text)
  const effectiveKind = kind ?? parsed.kind ?? 'other'
  const canSave = !!parsed.title || atts.length > 0

  const save = useCallback(async () => {
    if (!canSave || saving) return
    setSaving(true)
    const p = parseCapture(text)
    const idea = newIdea({
      title: p.title || (atts[0]?.type === 'audio' ? 'Ghi âm ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Ý tưởng chưa đặt tên'),
      body: p.body,
      tags: p.tags,
      kind: kind ?? p.kind ?? 'other',
    })
    await db.transaction('rw', db.ideas, db.attachments, async () => {
      await db.ideas.add(idea)
      await db.attachments.bulkAdd(atts.map((a) => ({ ...a, id: uid(), ideaId: idea.id, createdAt: Date.now() })))
    })
    if (getSettings().geotag) getLocation().then((loc) => loc && updateIdea(idea.id, { location: loc }))
    writeDraft('')
    toast('Đã lưu ý tưởng ✨', { label: 'Mở', run: () => go('/idea/' + idea.id) })
    onClose()
  }, [atts, canSave, kind, onClose, saving, text, toast])

  const appendText = useCallback((t: string) => {
    setText((cur) => (cur && !/\s$/.test(cur) ? cur + ' ' : cur) + t)
  }, [])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Ghi ý tưởng mới" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <textarea
          ref={taRef}
          className="capture-input"
          placeholder={'Ý tưởng gì vừa loé lên?\n\nDòng đầu là tiêu đề. Gõ #tag để gắn nhãn, @app / @web / @startup để chọn loại.'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              save()
            }
            if (e.key === 'Escape') onClose()
          }}
          rows={6}
        />
        {interim && <div className="interim">🗣️ {interim}</div>}
        {parsed.tags.length > 0 && (
          <div className="tag-row">
            {parsed.tags.map((t) => (
              <span key={t} className="tag">
                #{t}
              </span>
            ))}
          </div>
        )}
        <AttachmentList items={atts} onRemove={(i) => setAtts((xs) => xs.filter((_, j) => j !== i))} />
        <div className="chips" role="radiogroup" aria-label="Loại ý tưởng">
          {KINDS.map((k) => (
            <button
              key={k.value}
              role="radio"
              aria-checked={effectiveKind === k.value}
              className={'chip' + (effectiveKind === k.value ? ' on' : '')}
              onClick={() => setKind(k.value)}
            >
              {k.emoji} {k.label}
            </button>
          ))}
        </div>
        <div className="sheet-footer">
          <MediaTools onText={appendText} onInterim={setInterim} onAttach={(a) => setAtts((xs) => [...xs, a])} />
          <button className="btn primary big" disabled={!canSave || saving} onClick={save}>
            Lưu
          </button>
        </div>
      </div>
    </div>
  )
}
