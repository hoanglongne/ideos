import { useLiveQuery } from 'dexie-react-hooks'
import { Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { db, newIdea, updateIdea } from '../db'
import { getLocation } from '../lib/media'
import { go } from '../lib/router'
import { getSettings } from '../lib/settings'
import { matchesQuery, parseCapture, timeAgo, uid } from '../lib/util'
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

type Mode = 'new' | 'append'

export function CaptureSheet({ initialText, targetId, onClose }: { initialText?: string; targetId?: string; onClose: () => void }) {
  const [text, setText] = useState(() => initialText || readDraft())
  const [mode, setMode] = useState<Mode>(targetId ? 'append' : 'new')
  const [target, setTarget] = useState<string | null>(targetId ?? null)
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
  const canSave = mode === 'new' ? !!parsed.title || atts.length > 0 : !!target && (!!text.trim() || atts.length > 0)

  const saveNew = async () => {
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
    toast('Đã lưu ý tưởng', { label: 'Mở', run: () => go('/idea/' + idea.id) })
  }

  /** Ghi tiếp: chữ thành một dòng nhật ký, #tag gộp vào tag của ý tưởng, ảnh/ghi âm gắn vào ý tưởng đó. */
  const saveAppend = async (id: string) => {
    const tags = parseCapture(text).tags
    const clean = text.replace(/(^|\s)#[\p{L}\p{N}_-]+/gu, '$1').trim()
    await db.transaction('rw', db.ideas, db.attachments, async () => {
      const idea = await db.ideas.get(id)
      if (!idea) return
      const note = clean || (atts[0]?.type === 'audio' ? 'Ghi âm thêm' : 'Thêm ảnh')
      await db.ideas.update(id, {
        journal: [...idea.journal, { id: uid(), at: Date.now(), kind: 'note', text: note }],
        tags: [...new Set([...idea.tags, ...tags])],
        updatedAt: Date.now(),
      })
      await db.attachments.bulkAdd(atts.map((a) => ({ ...a, id: uid(), ideaId: id, createdAt: Date.now() })))
    })
    const title = (await db.ideas.get(id))?.title ?? ''
    toast(`Đã ghi vào “${title.length > 32 ? title.slice(0, 30) + '…' : title}”`, { label: 'Mở', run: () => go('/idea/' + id) })
  }

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    if (mode === 'new') await saveNew()
    else await saveAppend(target!)
    writeDraft('')
    onClose()
  }

  const appendText = useCallback((t: string) => {
    setText((cur) => (cur && !/\s$/.test(cur) ? cur + ' ' : cur) + t)
  }, [])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={mode === 'new' ? 'Ghi ý tưởng mới' : 'Ghi tiếp vào ý tưởng có sẵn'} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <div className="seg" role="tablist" aria-label="Ghi vào đâu">
            <button role="tab" aria-selected={mode === 'new'} className={mode === 'new' ? 'on' : ''} onClick={() => setMode('new')}>
              Ý tưởng mới
            </button>
            <button role="tab" aria-selected={mode === 'append'} className={mode === 'append' ? 'on' : ''} onClick={() => setMode('append')}>
              Ghi tiếp vào…
            </button>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng">
            <X size={18} strokeWidth={1.7} />
          </button>
        </div>
        {mode === 'append' && <TargetPicker value={target} onChange={setTarget} />}
        <textarea
          ref={taRef}
          className={'capture-input' + (mode === 'append' ? ' short' : '')}
          placeholder={
            mode === 'new'
              ? 'Vừa nghĩ ra gì?\n\nDòng đầu là tiêu đề. Gõ #tag để gắn nhãn, @app hay @web để chọn loại.'
              : 'Nghĩ thêm được gì về ý tưởng này? Một góc nhìn mới, một người cần nó, một cách kiếm tiền…'
          }
          aria-label={mode === 'new' ? 'Nội dung ý tưởng' : 'Ghi chú thêm'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              save()
            }
            if (e.key === 'Escape') onClose()
          }}
          rows={mode === 'new' ? 6 : 4}
        />
        {interim && <div className="interim">{interim}</div>}
        {parsed.tags.length > 0 && (
          <p className="parsed">
            Sẽ gắn tag{' '}
            {parsed.tags.map((t) => (
              <span key={t} className="tag">
                #{t}
              </span>
            ))}
          </p>
        )}
        <AttachmentList items={atts} onRemove={(i) => setAtts((xs) => xs.filter((_, j) => j !== i))} />
        {mode === 'new' && (
          <div className="kind-picker" role="radiogroup" aria-label="Loại ý tưởng">
            {KINDS.map((k) => (
              <button key={k.value} role="radio" aria-checked={effectiveKind === k.value} className={'kind-opt' + (effectiveKind === k.value ? ' on' : '')} onClick={() => setKind(k.value)}>
                {k.label}
              </button>
            ))}
          </div>
        )}
        <div className="sheet-footer">
          <MediaTools onText={appendText} onInterim={setInterim} onAttach={(a) => setAtts((xs) => [...xs, a])} />
          <button className="btn primary" disabled={!canSave || saving} onClick={save} title="Ctrl + Enter">
            {mode === 'new' ? 'Lưu ý tưởng' : 'Ghi vào nhật ký'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Chọn ý tưởng để ghi tiếp: mặc định là những cái vừa động tới, gõ để tìm (không cần dấu). */
function TargetPicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const [q, setQ] = useState('')
  const ideas = useLiveQuery(() => db.ideas.orderBy('updatedAt').reverse().filter((i) => i.status !== 'dropped').toArray(), [])
  const shown = (ideas ?? []).filter((i) => i.id === value || matchesQuery(i, q)).slice(0, q.trim() ? 8 : 5)
  return (
    <div className="target-picker">
      <label className="search">
        <Search size={15} strokeWidth={1.8} aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm ý tưởng" aria-label="Tìm ý tưởng để ghi tiếp" />
      </label>
      <div className="target-list" role="radiogroup" aria-label="Ý tưởng">
        {shown.map((i) => (
          <button key={i.id} role="radio" aria-checked={value === i.id} className={'target' + (value === i.id ? ' on' : '')} onClick={() => onChange(i.id)}>
            <span className="target-title">{i.title}</span>
            <span className="muted">{i.journal.length ? `${i.journal.length} ghi chú · ` : ''}sửa {timeAgo(i.updatedAt)}</span>
          </button>
        ))}
        {ideas && !shown.length && <p className="panel-note">Không tìm thấy ý tưởng nào khớp.</p>}
      </div>
    </div>
  )
}
