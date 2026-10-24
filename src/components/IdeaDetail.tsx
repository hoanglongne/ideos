import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Copy, MapPin, Pin, Share2, Trash2, X } from 'lucide-react'
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
      <div className="detail">
        <h1 className="detail-missing">Không tìm thấy ý tưởng này</h1>
        <p className="muted">Có thể nó đã bị xoá trên máy khác.</p>
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

  const filled = CANVAS_FIELDS.filter((f) => idea.canvas[f.key].trim()).length
  const done = idea.tasks.filter((t) => t.done).length

  return (
    <div className="detail">
      <div className="detail-bar">
        <button className="btn ghost" onClick={back}>
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden /> Ý tưởng
        </button>
        <div className="push" />
        <button className={'icon-btn' + (idea.pinned ? ' on' : '')} onClick={() => set({ pinned: !idea.pinned })} aria-pressed={idea.pinned} aria-label={idea.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'} title={idea.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}>
          <Pin size={17} strokeWidth={1.7} />
        </button>
        <button className="icon-btn" onClick={share} aria-label="Chia sẻ hoặc chép Markdown" title="Chia sẻ / chép Markdown">
          <Share2 size={17} strokeWidth={1.7} />
        </button>
        <button className="icon-btn" onClick={duplicate} aria-label="Nhân bản" title="Nhân bản">
          <Copy size={17} strokeWidth={1.7} />
        </button>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <h1 className="detail-title">
            <EditableText value={idea.title} onSave={(title) => set({ title })} placeholder="Tiêu đề ý tưởng" multiline={false} ariaLabel="Tiêu đề" />
          </h1>
          <div className="meta-line">
            <select className="quiet-select" value={idea.kind} onChange={(e) => set({ kind: e.target.value as Idea['kind'] })} aria-label="Loại">
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <span>Ghi {timeAgo(idea.createdAt)}</span>
            {idea.updatedAt - idea.createdAt > 60_000 && <span>sửa {timeAgo(idea.updatedAt)}</span>}
            {idea.location && (
              <a href={`https://www.openstreetmap.org/?mlat=${idea.location.lat}&mlon=${idea.location.lng}#map=16/${idea.location.lat}/${idea.location.lng}`} target="_blank" rel="noreferrer">
                <MapPin size={13} strokeWidth={1.8} aria-hidden /> Nơi nảy ra
              </a>
            )}
          </div>

          <div className="status-track" role="radiogroup" aria-label="Giai đoạn">
            {STATUSES.map((s) => (
              <button key={s.value} role="radio" aria-checked={idea.status === s.value} className={'status-opt' + (idea.status === s.value ? ' on tone-' + s.tone : '')} onClick={() => set({ status: s.value })}>
                {s.label}
              </button>
            ))}
          </div>

          <EditableText className="body-input" value={idea.body} onSave={(body) => set({ body })} placeholder="Ghi chú thêm: chi tiết, ai cần nó, vì sao bạn nghĩ tới…" ariaLabel="Ghi chú" />

          <AttachmentList items={atts} onRemove={(i) => removeAttachment(atts[i].id)} />
          <MediaTools
            onText={(t) => set({ body: (idea.body ? idea.body.trimEnd() + ' ' : '') + t })}
            onAttach={(a) => db.attachments.add({ ...a, id: uid(), ideaId: id, createdAt: Date.now() })}
          />

          <section className="block" aria-labelledby="tasks-h">
            <div className="block-head">
              <h2 id="tasks-h">Bước tiếp theo</h2>
              {idea.tasks.length > 0 && (
                <span className="muted num">
                  {done}/{idea.tasks.length}
                </span>
              )}
            </div>
            <Tasks idea={idea} onChange={(tasks) => set({ tasks })} />
          </section>

          <details className="block canvas-block" open={filled > 0}>
            <summary className="block-head">
              <h2>Lean canvas</h2>
              <span className="muted num">{filled}/6 ô</span>
            </summary>
            <div className="lean-canvas">
              {CANVAS_FIELDS.map((f) => (
                <label key={f.key} className="field">
                  <span className="field-label">{f.label}</span>
                  <EditableText className="field-input" value={idea.canvas[f.key]} placeholder={f.hint} ariaLabel={f.label} onSave={(v) => updateIdea(id, { [`canvas.${f.key}`]: v })} />
                </label>
              ))}
            </div>
          </details>
        </div>

        <aside className="detail-side">
          <section className="panel" aria-labelledby="ice-h">
            <div className="panel-head">
              <h2 id="ice-h">Điểm ICE</h2>
            </div>
            <IceScorer scores={idea.scores} onChange={(key, v) => updateIdea(id, { [`scores.${key}`]: v })} />
          </section>
          <section className="panel" aria-labelledby="tags-h">
            <div className="panel-head">
              <h2 id="tags-h">Tag</h2>
            </div>
            <TagEditor tags={idea.tags} onChange={(tags) => set({ tags })} />
          </section>
          <section className="panel" aria-labelledby="links-h">
            <div className="panel-head">
              <h2 id="links-h">Liên kết tham khảo</h2>
              {idea.links.length > 0 && <span className="muted num">{idea.links.length}</span>}
            </div>
            <Links links={idea.links} onChange={(links) => set({ links })} />
          </section>
          <section className="panel" aria-labelledby="rel-h">
            <div className="panel-head">
              <h2 id="rel-h">Ý tưởng liên quan</h2>
              {idea.related.length > 0 && <span className="muted num">{idea.related.length}</span>}
            </div>
            <Related idea={idea} />
          </section>
        </aside>

        <div className="delete-idea">
          <button className="text-btn danger" onClick={remove}>
            <Trash2 size={15} strokeWidth={1.8} aria-hidden /> Xoá ý tưởng này
          </button>
        </div>
      </div>
    </div>
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

function IceScorer({ scores, onChange }: { scores: Scores; onChange: (key: keyof Scores, v: number) => void }) {
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
        </label>
      ))}
    </div>
  )
}

const TASK_SUGGESTIONS = ['Tìm 3 đối thủ', 'Hỏi 5 người xem họ có cần không', 'Làm một landing page', 'Vẽ wireframe']

function Tasks({ idea, onChange }: { idea: Idea; onChange: (t: Idea['tasks']) => void }) {
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
          <input type="checkbox" checked={t.done} onChange={() => onChange(idea.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} aria-label={t.text} />
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

function Links({ links, onChange }: { links: string[]; onChange: (l: string[]) => void }) {
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

function Related({ idea }: { idea: Idea }) {
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
