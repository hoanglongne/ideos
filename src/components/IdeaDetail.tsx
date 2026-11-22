import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, MapPin } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { db, deleteIdea, newIdea, removeAttachment, restoreIdea, updateIdea } from '../db'
import { ideaToMarkdown } from '../lib/backup'
import { nextStep } from '../lib/journey'
import { summarize } from '../lib/money/plan'
import { suggestConfidence } from '../lib/insight'
import { back, go } from '../lib/router'
import { timeAgo, uid } from '../lib/util'
import { CANVAS_FIELDS, STATUSES, type Idea } from '../types'
import { AiCritiquePanel, isRawIdea, useTranscribe } from './AiPanel'
import { AttachmentList } from './Attachments'
import { Assumptions, EvidenceList } from './Assumptions'
import { EditableText } from './Editable'
import { Fold, openSection } from './Fold'
import { IceScorer, Links, Related, TagEditor, Tasks } from './IdeaParts'
import { IdeaMenu } from './IdeaMenu'
import { Journal } from './Journal'
import { NextStepCard } from './NextStepCard'
import { StageRail } from './StageRail'
import { useToast } from './Toast'

const MoneyPanel = lazy(() => import('./MoneyPanel').then((m) => ({ default: m.MoneyPanel })))

/** Một dòng tóm tắt cho tiêu đề mục tiền khi mục đang đóng. */
function moneyMeta(m: NonNullable<Idea['money']>) {
  const s = summarize(m.inputs)
  return s.breakEvenMonth ? `hoà vốn tháng ${s.breakEvenMonth}` : `chưa hoà vốn trong ${m.inputs.horizon} tháng`
}

/** Hook phải gọi trước khi biết ý tưởng có tồn tại hay không. */
const PLACEHOLDER = newIdea({ id: '' })

export function IdeaDetail({ id }: { id: string }) {
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
        <button className="btn" onClick={() => go('/')}>
          Về trang chủ
        </button>
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
  const focus = (s: string) => step.section === s
  const filled = CANVAS_FIELDS.filter((f) => idea.canvas[f.key].trim()).length
  const done = idea.tasks.filter((t) => t.done).length
  const tested = idea.assumptions.filter((a) => a.status === 'holds' || a.status === 'broken').length

  return (
    <article className="idea">
      <div className="idea-bar">
        <button className="btn ghost" onClick={back}>
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden /> Quay lại
        </button>
        <div className="push" />
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

      <header className="idea-head">
        <h1 className="idea-title">
          <EditableText value={idea.title} onSave={(title) => set({ title })} placeholder="Tiêu đề ý tưởng" multiline={false} ariaLabel="Tiêu đề" />
        </h1>
        <p className="idea-meta">
          {idea.pinned && <span>Đã ghim</span>}
          <span>Ghi {timeAgo(idea.createdAt)}</span>
          {idea.updatedAt - idea.createdAt > 60_000 && <span>sửa {timeAgo(idea.updatedAt)}</span>}
          {idea.location && (
            <a href={`https://www.openstreetmap.org/?mlat=${idea.location.lat}&mlon=${idea.location.lng}#map=16/${idea.location.lat}/${idea.location.lng}`} target="_blank" rel="noreferrer">
              <MapPin size={13} strokeWidth={1.8} aria-hidden /> Nơi nảy ra
            </a>
          )}
        </p>
      </header>

      <StageRail status={idea.status} />

      <NextStepCard idea={idea} step={step} onStatus={setStatus} onOpen={openSection} />

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

      <div className="parts">
        <Fold ideaId={id} id="assumptions" headingId="as-h" title="Giả định" defaultOpen={focus('assumptions')} meta={idea.assumptions.length > 0 && `${tested}/${idea.assumptions.length} đã thử`}>
          <Assumptions idea={idea} onCoach={() => go(`/idea/${id}/coach`)} />
          <AiCritiquePanel idea={idea} />
        </Fold>

        <Fold ideaId={id} id="evidence" headingId="ev-h" title="Bằng chứng" defaultOpen={focus('evidence')} meta={idea.evidence.length > 0 && String(idea.evidence.length)}>
          <EvidenceList idea={idea} />
        </Fold>

        <Fold ideaId={id} id="money" headingId="money-h" title="Bài toán tiền" defaultOpen={focus('money')} meta={idea.money && moneyMeta(idea.money)}>
          <Suspense fallback={<div className="route-loading" role="status" aria-label="Đang tải" />}>
            <MoneyPanel idea={idea} />
          </Suspense>
        </Fold>

        <Fold ideaId={id} id="journal" headingId="journal-h" title="Nhật ký" defaultOpen={focus('journal')} meta={idea.journal.length > 0 && `${idea.journal.length} ghi chú`}>
          <Journal idea={idea} />
        </Fold>

        <Fold ideaId={id} id="tasks" headingId="tasks-h" title="Việc cần làm" defaultOpen={focus('tasks')} meta={idea.tasks.length > 0 && `${done}/${idea.tasks.length}`}>
          <Tasks idea={idea} onChange={(tasks) => set({ tasks })} />
        </Fold>

        <Fold ideaId={id} id="canvas" title="Lean canvas" defaultOpen={focus('canvas')} meta={`${filled}/6 ô`}>
          <div className="lean-canvas">
            {CANVAS_FIELDS.map((f) => (
              <label key={f.key} className="field">
                <span className="field-label">{f.label}</span>
                <EditableText className="field-input" value={idea.canvas[f.key]} placeholder={f.hint} ariaLabel={f.label} onSave={(v) => updateIdea(id, { [`canvas.${f.key}`]: v })} />
              </label>
            ))}
          </div>
        </Fold>

        <Fold ideaId={id} id="details" title="Điểm, nhãn và liên kết" defaultOpen={focus('details')} meta={idea.tags.length + idea.links.length + idea.related.length > 0 && `${idea.tags.length} nhãn`}>
          <h3 className="part-h">Điểm ICE</h3>
          <IceScorer scores={idea.scores} hint={suggestConfidence(idea)} onChange={(key, v) => updateIdea(id, { [`scores.${key}`]: v })} />
          <h3 className="part-h">Nhãn</h3>
          <TagEditor tags={idea.tags} onChange={(tags) => set({ tags })} />
          <h3 className="part-h">Liên kết tham khảo</h3>
          <Links links={idea.links} onChange={(links) => set({ links })} />
          <h3 className="part-h">Ý tưởng liên quan</h3>
          <Related idea={idea} />
        </Fold>
      </div>
    </article>
  )
}
