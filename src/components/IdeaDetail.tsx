import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db, deleteIdea, linkIdeas, removeAttachment, restoreIdea, updateIdea } from '../db'
import { ideaToMarkdown } from '../lib/backup'
import { back, go } from '../lib/router'
import { fold, iceScore, kindMeta, matchesQuery, timeAgo, uid } from '../lib/util'
import { CANVAS_FIELDS, KINDS, STATUSES, type Idea, type Scores } from '../types'
import { AttachmentList } from './Attachments'
import { EditableText } from './Editable'
import { MediaTools } from './MediaTools'
import { useToast } from './Toast'

export function IdeaDetail({ id }: { id: string }) {
  const idea = useLiveQuery(() => db.ideas.get(id), [id], null)
  const atts = useLiveQuery(() => db.attachments.where('ideaId').equals(id).sortBy('createdAt'), [id], [])
  const toast = useToast()

  if (idea === null) return null
  if (!idea)
    return (
      <div className="empty">
        <p>Không tìm thấy ý tưởng này.</p>
        <button className="btn" onClick={() => go('/')}>
          Về danh sách
        </button>
      </div>
    )

  const set = (changes: Partial<Idea>) => updateIdea(id, changes)

  const remove = async () => {
    const snap = await deleteIdea(id)
    go('/')
    toast('Đã xoá ý tưởng', { label: 'Hoàn tác', run: () => restoreIdea(snap) })
  }

  const duplicate = async () => {
    const now = Date.now()
    const copy: Idea = { ...idea, id: uid(), title: idea.title + ' (bản sao)', related: [], reviewedAt: undefined, createdAt: now, updatedAt: now }
    await db.ideas.add(copy)
    go('/idea/' + copy.id)
  }

  const share = async () => {
    const text = ideaToMarkdown(idea)
    try {
      if (navigator.share) await navigator.share({ title: idea.title, text })
      else {
        await navigator.clipboard.writeText(text)
        toast('Đã chép dạng Markdown')
      }
    } catch {
      /* người dùng huỷ */
    }
  }

  return (
    <div className="detail">
      <div className="detail-bar">
        <button className="btn ghost" onClick={back} aria-label="Quay lại">
          ← Quay lại
        </button>
        <div className="push" />
        <button className={'btn ghost' + (idea.pinned ? ' on' : '')} onClick={() => set({ pinned: !idea.pinned })} title="Ghim">
          📌
        </button>
        <button className="btn ghost" onClick={share} title="Chia sẻ / chép">
          ↗
        </button>
        <button className="btn ghost" onClick={duplicate} title="Nhân bản">
          ⧉
        </button>
        <button className="btn ghost danger" onClick={remove} title="Xoá">
          🗑
        </button>
      </div>

      <EditableText className="title-input" value={idea.title} onSave={(title) => set({ title })} placeholder="Tiêu đề ý tưởng" multiline={false} />

      <div className="row wrap gap">
        <select value={idea.kind} onChange={(e) => set({ kind: e.target.value as Idea['kind'] })} aria-label="Loại">
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.emoji} {k.label}
            </option>
          ))}
        </select>
        <TagEditor tags={idea.tags} onChange={(tags) => set({ tags })} />
      </div>

      <div className="chips scroll status-picker">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            className={'chip' + (idea.status === s.value ? ' on' : '')}
            style={{ '--c': s.color } as React.CSSProperties}
            onClick={() => set({ status: s.value })}
          >
            <span className="dot" style={{ background: s.color }} /> {s.label}
          </button>
        ))}
      </div>

      <EditableText className="body-input" value={idea.body} onSave={(body) => set({ body })} placeholder="Ghi chú thêm, chi tiết, cảm hứng…" />

      <AttachmentList items={atts} onRemove={(i) => removeAttachment(atts[i].id)} />
      <MediaTools
        onText={(t) => set({ body: (idea.body ? idea.body.trimEnd() + ' ' : '') + t })}
        onAttach={(a) => db.attachments.add({ ...a, id: uid(), ideaId: id, createdAt: Date.now() })}
      />

      <Section title="⚡ Chấm điểm ICE" defaultOpen={iceScore(idea) !== null}>
        <IceScorer scores={idea.scores} onChange={(key, v) => updateIdea(id, { [`scores.${key}`]: v })} />
      </Section>

      <Section title="🧭 Lean canvas" defaultOpen={Object.values(idea.canvas).some(Boolean)}>
        <div className="canvas">
          {CANVAS_FIELDS.map((f) => (
            <label key={f.key} className="canvas-field">
              <span className="label">{f.label}</span>
              <EditableText value={idea.canvas[f.key]} placeholder={f.hint} ariaLabel={f.label} onSave={(v) => updateIdea(id, { [`canvas.${f.key}`]: v })} />
            </label>
          ))}
        </div>
      </Section>

      <Section title={`☑ Bước tiếp theo${idea.tasks.length ? ` (${idea.tasks.filter((t) => t.done).length}/${idea.tasks.length})` : ''}`} defaultOpen>
        <Tasks idea={idea} onChange={(tasks) => set({ tasks })} />
      </Section>

      <Section title="🔗 Liên kết & tham khảo" defaultOpen={idea.links.length > 0}>
        <Links links={idea.links} onChange={(links) => set({ links })} />
      </Section>

      <Section title={`🕸 Ý tưởng liên quan${idea.related.length ? ` (${idea.related.length})` : ''}`} defaultOpen={idea.related.length > 0}>
        <Related idea={idea} />
      </Section>

      <div className="meta-foot muted small">
        <span>Tạo {new Date(idea.createdAt).toLocaleString('vi-VN')}</span>
        <span>Sửa {timeAgo(idea.updatedAt)}</span>
        {idea.location && (
          <a href={`https://www.openstreetmap.org/?mlat=${idea.location.lat}&mlon=${idea.location.lng}#map=16/${idea.location.lat}/${idea.location.lng}`} target="_blank" rel="noreferrer">
            📍 Nơi nảy ra ý tưởng (±{idea.location.accuracy}m)
          </a>
        )}
      </div>
    </div>
  )
}

function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details className="section" open={defaultOpen}>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  )
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
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
            ×
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
        placeholder="+ tag"
        aria-label="Thêm tag"
      />
    </div>
  )
}

const ICE_LABELS: { key: keyof Scores; label: string; hint: string }[] = [
  { key: 'impact', label: 'Impact', hint: 'Tác động / giá trị nếu thành công' },
  { key: 'confidence', label: 'Confidence', hint: 'Mức tự tin rằng nó sẽ hiệu quả' },
  { key: 'ease', label: 'Ease', hint: 'Dễ làm (10 = vài ngày là xong)' },
]

function IceScorer({ scores, onChange }: { scores: Scores; onChange: (key: keyof Scores, v: number) => void }) {
  const total = iceScore({ scores })
  return (
    <div className="ice-scorer">
      {ICE_LABELS.map((f) => (
        <label key={f.key} className="ice-row">
          <span className="ice-name">
            {f.label}
            <span className="muted small">{f.hint}</span>
          </span>
          <input type="range" min={0} max={10} value={scores[f.key]} onChange={(e) => onChange(f.key, +e.target.value)} />
          <span className="ice-val">{scores[f.key] || '–'}</span>
        </label>
      ))}
      <div className="ice-total">
        Điểm ICE: <b>{total ?? 'chưa đủ'}</b>
        <span className="muted small"> / 10 — dùng để xếp hạng nên làm cái nào trước</span>
      </div>
    </div>
  )
}

function Tasks({ idea, onChange }: { idea: Idea; onChange: (t: Idea['tasks']) => void }) {
  const [v, setV] = useState('')
  const add = () => {
    if (!v.trim()) return
    onChange([...idea.tasks, { id: uid(), text: v.trim(), done: false }])
    setV('')
  }
  return (
    <div className="tasks">
      {idea.tasks.map((t) => (
        <div key={t.id} className={'task' + (t.done ? ' done' : '')}>
          <input type="checkbox" checked={t.done} onChange={() => onChange(idea.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} aria-label={t.text} />
          <EditableText value={t.text} multiline={false} onSave={(text) => onChange(idea.tasks.map((x) => (x.id === t.id ? { ...x, text } : x)))} />
          <button className="icon-btn" aria-label="Xoá việc" onClick={() => onChange(idea.tasks.filter((x) => x.id !== t.id))}>
            ×
          </button>
        </div>
      ))}
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="VD: Hỏi 5 người xem họ có cần không" aria-label="Thêm việc" />
        <button className="btn" type="submit">
          Thêm
        </button>
      </form>
      {idea.tasks.length === 0 && (
        <div className="chips">
          {['Tìm 3 đối thủ', 'Phỏng vấn 5 người dùng', 'Làm landing page', 'Vẽ wireframe'].map((s) => (
            <button key={s} className="chip" onClick={() => onChange([...idea.tasks, { id: uid(), text: s, done: false }])}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Links({ links, onChange }: { links: string[]; onChange: (l: string[]) => void }) {
  const [v, setV] = useState('')
  return (
    <div className="links">
      {links.map((l) => (
        <div key={l} className="link-row">
          <a href={/^https?:\/\//.test(l) ? l : 'https://' + l} target="_blank" rel="noreferrer">
            {l.replace(/^https?:\/\//, '')}
          </a>
          <button className="icon-btn" aria-label="Xoá liên kết" onClick={() => onChange(links.filter((x) => x !== l))}>
            ×
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
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Dán link đối thủ, bài viết, cảm hứng…" inputMode="url" aria-label="Thêm liên kết" />
        <button className="btn" type="submit">
          Thêm
        </button>
      </form>
    </div>
  )
}

function Related({ idea }: { idea: Idea }) {
  const all = useLiveQuery(() => db.ideas.toArray(), [], [])
  const [q, setQ] = useState('')
  const linked = all.filter((i) => idea.related.includes(i.id))
  const suggestions = useMemo(() => {
    const others = all.filter((i) => i.id !== idea.id && !idea.related.includes(i.id))
    if (q.trim()) return others.filter((i) => matchesQuery(i, q)).slice(0, 6)
    // gợi ý theo tag chung / từ chung trong tiêu đề
    const words = new Set(fold(idea.title).split(/\W+/).filter((w) => w.length > 3))
    return others
      .map((i) => ({
        i,
        s: i.tags.filter((t) => idea.tags.includes(t)).length * 2 + fold(i.title).split(/\W+/).filter((w) => words.has(w)).length,
      }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 4)
      .map((x) => x.i)
  }, [all, idea, q])

  return (
    <div className="related">
      {linked.map((i) => (
        <div key={i.id} className="link-row">
          <a href={'#/idea/' + i.id}>
            {kindMeta(i.kind).emoji} {i.title}
          </a>
          <button className="icon-btn" aria-label="Bỏ liên kết" onClick={() => linkIdeas(idea.id, i.id, false)}>
            ×
          </button>
        </div>
      ))}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm ý tưởng để nối…" aria-label="Tìm ý tưởng liên quan" />
      {suggestions.length > 0 && (
        <div className="chips">
          {!q && <span className="muted small">Gợi ý:</span>}
          {suggestions.map((i) => (
            <button key={i.id} className="chip" onClick={() => (linkIdeas(idea.id, i.id, true), setQ(''))}>
              + {kindMeta(i.kind).emoji} {i.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
