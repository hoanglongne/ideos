import { useLiveQuery } from 'dexie-react-hooks'
import { MapPin } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { db, deleteIdea, newIdea, removeAttachment, restoreIdea, updateIdea } from '../db'
import { ideaToMarkdown } from '../lib/backup'
import { nextStep } from '../lib/journey'
import { summarize } from '../lib/money/plan'
import { go } from '../lib/router'
import { timeAgo, uid } from '../lib/util'
import { CANVAS_FIELDS, STATUSES, type Idea } from '../types'
import { isRawIdea, useTranscribe } from './AiPanel'
import { AttachmentList } from './Attachments'
import { EditableText } from './Editable'
import { IdeaMenu } from './IdeaMenu'
import { Journal } from './Journal'
import { Now } from './Now'
import { Questions } from './Questions'
import { Tasks } from './Tasks'
import { useToast } from './Toast'

const MoneyPanel = lazy(() => import('./MoneyPanel').then((m) => ({ default: m.MoneyPanel })))

/** Một dòng tóm tắt cho tiêu đề mục tiền khi mục đang đóng. */
function moneyMeta(m: NonNullable<Idea['money']>) {
  const s = summarize(m.inputs)
  return s.breakEvenMonth ? `hoà vốn tháng ${s.breakEvenMonth}` : `chưa hoà vốn trong ${m.inputs.horizon} tháng`
}

/** Hook phải gọi trước khi biết ý tưởng có tồn tại hay không. */
const PLACEHOLDER = newIdea({ id: '' })

/**
 * Một ý tưởng: tên, việc phải làm BÂY GIỜ, điều phải đúng, rồi ghi chú / tiền / việc cần làm xếp gọn bên dưới.
 * Canvas, điểm ICE, nhãn, liên kết, ý tưởng liên quan không còn hiện ra (dữ liệu vẫn giữ nguyên).
 */
export function IdeaPage({ id }: { id: string }) {
  const idea = useLiveQuery(() => db.ideas.get(id), [id], null)
  const atts = useLiveQuery(() => db.attachments.where('ideaId').equals(id).sortBy('createdAt'), [id], [])
  const toast = useToast()
  const tr = useTranscribe(idea ?? PLACEHOLDER)

  if (idea === null) return null
  if (!idea)
    return (
      <div className="idea">
        <h1 className="idea-title">Không tìm thấy ý tưởng này</h1>
        <p className="muted">Có thể nó đã bị xoá trên máy khác.</p>
        <p style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => go('/')}>
            Về trang chủ
          </button>
        </p>
      </div>
    )

  const set = (changes: Partial<Idea>) => updateIdea(id, changes)

  /** Đổi giai đoạn và ghi lại vào nhật ký, để thấy ý tưởng đã đi qua những bước nào. */
  const setStatus = (status: Idea['status']) => {
    if (status === idea.status) return
    const from = STATUSES.find((s) => s.value === idea.status)!.label
    const to = STATUSES.find((s) => s.value === status)!.label
    set({ status, journal: [...idea.journal, { id: uid(), at: Date.now(), kind: 'status', text: `Chuyển từ “${from}” sang “${to}”.` }] })
  }

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

  const step = nextStep(idea)
  const stage = STATUSES.find((s) => s.value === idea.status)!.label
  const done = idea.tasks.filter((t) => t.done).length
  const holds = idea.assumptions.filter((a) => a.status === 'holds').length
  const broken = idea.assumptions.filter((a) => a.status === 'broken').length
  const summary = [`${holds} giả định đúng, ${broken} sai`, idea.money ? 'Tiền: ' + moneyMeta(idea.money) : null].filter(Boolean).join(' · ')
  const showTasks = idea.tasks.length > 0 || idea.status === 'building' || idea.status === 'shipped'

  return (
    <article className="idea">
      <div className="idea-top">
        <p className="idea-stage">{stage}</p>
        <IdeaMenu
          idea={idea}
          onStatus={setStatus}
          onKind={(kind) => set({ kind })}
          onPin={() => set({ pinned: !idea.pinned })}
          onShare={share}
          onDuplicate={duplicate}
          onRemove={remove}
          coachHref={`#/idea/${id}/coach`}
        />
      </div>

      <h1 className="idea-title">
        <EditableText value={idea.title} onSave={(title) => set({ title })} placeholder="Tiêu đề ý tưởng" multiline={false} ariaLabel="Tiêu đề" />
      </h1>
      <p className="idea-meta">
        Ghi {timeAgo(idea.createdAt)}
        {idea.updatedAt - idea.createdAt > 60_000 && ` · sửa ${timeAgo(idea.updatedAt)}`}
        {idea.tags.length > 0 && ' · ' + idea.tags.map((t) => '#' + t).join(' ')}
        {idea.location && (
          <>
            {' · '}
            <a href={`https://www.openstreetmap.org/?mlat=${idea.location.lat}&mlon=${idea.location.lng}#map=16/${idea.location.lat}/${idea.location.lng}`} target="_blank" rel="noreferrer">
              <MapPin size={13} strokeWidth={1.8} aria-hidden /> Nơi nảy ra
            </a>
          </>
        )}
      </p>

      <Now idea={idea} step={step} summary={summary} onStatus={setStatus} />

      <EditableText className="body-input" value={idea.body} onSave={(body) => set({ body })} placeholder="Mô tả ý tưởng: nó là gì, cho ai, vì sao bạn nghĩ tới…" ariaLabel="Mô tả" />

      {tr.ready && isRawIdea(idea) && atts.some((a) => a.type === 'audio') && (
        <p className="stage-hint">
          Ý tưởng này mới chỉ có ghi âm.{' '}
          <button className="text-btn" disabled={!!tr.busyId} onClick={() => tr.run(atts.find((a) => a.type === 'audio')!)}>
            {tr.busyId ? 'AI đang nghe…' : 'Chép lời và sắp xếp bằng AI'}
          </button>
        </p>
      )}

      <AttachmentList
        items={atts}
        onRemove={(i) => removeAttachment(atts[i].id)}
        extra={(a) =>
          a.type === 'audio' && tr.ready ? (
            <button className="text-btn att-transcribe" disabled={!!tr.busyId} onClick={() => tr.run(a)}>
              {tr.busyId === a.id ? 'Đang chép…' : 'Chép lời'}
            </button>
          ) : null
        }
      />

      {CANVAS_FIELDS.some((f) => idea.canvas[f.key].trim()) && (
        <details id="sec-canvas" className="sec sec-fold">
          <summary>
            <div className="sec-h">
              <h2 id="canvas-h">Đã mài</h2>
              <span>{CANVAS_FIELDS.filter((f) => idea.canvas[f.key].trim()).length}/{CANVAS_FIELDS.length}</span>
            </div>
          </summary>
          <div className="sec-body">
            {CANVAS_FIELDS.map((f) => (
              <label key={f.key} className="field">
                <span className="field-label">{f.label}</span>
                <EditableText className="field-input" value={idea.canvas[f.key]} placeholder={f.hint} ariaLabel={f.label} onSave={(v) => updateIdea(id, { [`canvas.${f.key}`]: v })} />
              </label>
            ))}
          </div>
        </details>
      )}

      <Questions idea={idea} onCoach={() => go(`/idea/${id}/coach`)} />

      <details id="sec-money" className="sec sec-fold">
        <summary>
          <div className="sec-h">
            <h2 id="money-h">Tiền</h2>
            <span>{idea.money ? moneyMeta(idea.money) : 'chưa tính'}</span>
          </div>
        </summary>
        <div className="sec-body">
          <Suspense fallback={<div className="route-loading" role="status" aria-label="Đang tải" />}>
            <MoneyPanel idea={idea} />
          </Suspense>
        </div>
      </details>

      <details id="sec-journal" className="sec sec-fold">
        <summary>
          <div className="sec-h">
            <h2 id="journal-h">Ghi chú</h2>
            <span>{idea.journal.length > 0 ? `${idea.journal.length} dòng` : 'thêm'}</span>
          </div>
        </summary>
        <div className="sec-body">
          <Journal idea={idea} />
        </div>
      </details>

      {showTasks && (
        <details id="sec-tasks" className="sec sec-fold">
          <summary>
            <div className="sec-h">
              <h2 id="tasks-h">Việc cần làm</h2>
              <span>{idea.tasks.length > 0 ? `${done}/${idea.tasks.length}` : 'thêm'}</span>
            </div>
          </summary>
          <div className="sec-body">
            <Tasks idea={idea} onChange={(tasks) => set({ tasks })} />
          </div>
        </details>
      )}
    </article>
  )
}
