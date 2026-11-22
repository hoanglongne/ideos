import { useLiveQuery } from 'dexie-react-hooks'
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { db, linkIdeas } from '../db'
import { type ConfidenceHint } from '../lib/insight'
import { fold, iceScore, kindMeta, matchesQuery, uid } from '../lib/util'
import { type Idea, type Scores } from '../types'
import { EditableText } from './Editable'

export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [v, setV] = useState('')
  const add = () => {
    const t = v.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-')
    if (t && !tags.includes(t)) onChange([...tags, t])
    setV('')
  }
  return (
    <div className="tag-editor">
      {tags.map((t) => (
        <span key={t} className="tag">
          #{t}
          <button aria-label={`Bỏ tag ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            <X size={12} strokeWidth={2} />
          </button>
        </span>
      ))}
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          } else if (e.key === 'Backspace' && !v && tags.length) onChange(tags.slice(0, -1))
        }}
        onBlur={add}
        placeholder={tags.length ? 'Thêm tag' : 'Gõ tag rồi Enter'}
        aria-label="Thêm tag"
      />
    </div>
  )
}

const ICE_LABELS: { key: keyof Scores; label: string; hint: string }[] = [
  { key: 'impact', label: 'Tác động', hint: 'Giá trị nếu thành công' },
  { key: 'confidence', label: 'Tự tin', hint: 'Khả năng nó hiệu quả' },
  { key: 'ease', label: 'Dễ làm', hint: '10 là vài ngày xong' },
]

export function IceScorer({ scores, hint, onChange }: { scores: Scores; hint: ConfidenceHint | null; onChange: (key: keyof Scores, v: number) => void }) {
  const total = iceScore({ scores })
  return (
    <div className="ice">
      <p className="ice-total">
        <span className={'ice-figure big num' + (total === null ? ' none' : '')}>{total === null ? '—' : total.toFixed(1)}</span>
        <span className="muted">{total === null ? 'Chấm đủ 3 mục để có điểm' : 'trên 10, dùng để xếp hạng'}</span>
      </p>
      {ICE_LABELS.map((f) => (
        <label key={f.key} className="ice-row">
          <span className="ice-name">
            {f.label}
            <span className="muted">{f.hint}</span>
          </span>
          <span className={'ice-val num' + (scores[f.key] ? '' : ' none')}>{scores[f.key] || '—'}</span>
          <input type="range" min={0} max={10} value={scores[f.key]} onChange={(e) => onChange(f.key, +e.target.value)} aria-label={f.label} />
          {f.key === 'confidence' && hint && hint.value !== scores.confidence && (
            <span className="ice-hint">
              Từ bằng chứng: <b className="num">{hint.value}</b> ({hint.reason}).{' '}
              <button type="button" className="text-btn" onClick={() => onChange('confidence', hint.value)}>
                Dùng
              </button>
            </span>
          )}
        </label>
      ))}
    </div>
  )
}

const TASK_SUGGESTIONS = ['Tìm 3 đối thủ', 'Hỏi 5 người xem họ có cần không', 'Làm một landing page', 'Vẽ wireframe']

export function Tasks({ idea, onChange }: { idea: Idea; onChange: (t: Idea['tasks']) => void }) {
  const [v, setV] = useState('')
  const add = (text: string) => {
    if (!text.trim()) return
    onChange([...idea.tasks, { id: uid(), text: text.trim(), done: false }])
    setV('')
  }
  return (
    <div className="tasks">
      {idea.tasks.map((t) => (
        <div key={t.id} className={'task' + (t.done ? ' done' : '')}>
          <label className="check-hit">
            <input type="checkbox" checked={t.done} onChange={() => onChange(idea.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} aria-label={t.text} />
          </label>
          <EditableText value={t.text} multiline={false} ariaLabel="Nội dung việc" onSave={(text) => onChange(idea.tasks.map((x) => (x.id === t.id ? { ...x, text } : x)))} />
          <button className="icon-btn small" aria-label="Xoá việc" onClick={() => onChange(idea.tasks.filter((x) => x.id !== t.id))}>
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>
      ))}
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault()
          add(v)
        }}
      >
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Việc nhỏ nhất để tiến thêm một bước" aria-label="Thêm việc" />
        <button className="btn" type="submit" disabled={!v.trim()}>
          Thêm
        </button>
      </form>
      {idea.tasks.length === 0 && (
        <p className="suggest">
          Gợi ý:{' '}
          {TASK_SUGGESTIONS.map((s, i) => (
            <span key={s}>
              <button className="text-btn" onClick={() => add(s)}>
                {s}
              </button>
              {i < TASK_SUGGESTIONS.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

export function Links({ links, onChange }: { links: string[]; onChange: (l: string[]) => void }) {
  const [v, setV] = useState('')
  return (
    <div className="links">
      {links.map((l) => (
        <div key={l} className="link-row">
          <a href={/^https?:\/\//.test(l) ? l : 'https://' + l} target="_blank" rel="noreferrer">
            {l.replace(/^https?:\/\/(www\.)?/, '')}
          </a>
          <button className="icon-btn small" aria-label="Xoá liên kết" onClick={() => onChange(links.filter((x) => x !== l))}>
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>
      ))}
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault()
          const t = v.trim()
          if (t && !links.includes(t)) onChange([...links, t])
          setV('')
        }}
      >
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Dán link đối thủ, bài viết…" inputMode="url" aria-label="Thêm liên kết" />
        <button className="btn" type="submit" disabled={!v.trim()}>
          Thêm
        </button>
      </form>
    </div>
  )
}

export function Related({ idea }: { idea: Idea }) {
  const all = useLiveQuery(() => db.ideas.toArray(), [], [])
  const [q, setQ] = useState('')
  const linked = all.filter((i) => idea.related.includes(i.id))
  const suggestions = useMemo(() => {
    const others = all.filter((i) => i.id !== idea.id && !idea.related.includes(i.id))
    if (q.trim()) return others.filter((i) => matchesQuery(i, q)).slice(0, 5)
    // gợi ý theo tag chung / từ chung trong tiêu đề
    const words = new Set(fold(idea.title).split(/\W+/).filter((w) => w.length > 3))
    return others
      .map((i) => ({
        i,
        s: i.tags.filter((t) => idea.tags.includes(t)).length * 2 + fold(i.title).split(/\W+/).filter((w) => words.has(w)).length,
      }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map((x) => x.i)
  }, [all, idea, q])

  return (
    <div className="related">
      {linked.map((i) => (
        <div key={i.id} className="link-row">
          <a href={'#/idea/' + i.id}>{i.title}</a>
          <span className="muted">{kindMeta(i.kind).label}</span>
          <button className="icon-btn small" aria-label="Bỏ liên kết" onClick={() => linkIdeas(idea.id, i.id, false)}>
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>
      ))}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm ý tưởng để nối" aria-label="Tìm ý tưởng liên quan" />
      {suggestions.length > 0 && (
        <ul className="suggest-list" aria-label={q ? 'Kết quả' : 'Gợi ý'}>
          {suggestions.map((i) => (
            <li key={i.id}>
              <button className="text-btn" onClick={() => (linkIdeas(idea.id, i.id, true), setQ(''))}>
                Nối với “{i.title}”
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
