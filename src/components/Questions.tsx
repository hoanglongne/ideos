import { X } from 'lucide-react'
import { useState } from 'react'
import { updateIdea } from '../db'
import { uid } from '../lib/util'
import { ASSUMPTION_STATUSES, RISKS, SIGNALS, type Assumption, type Evidence, type Idea } from '../types'
import { AiCritiquePanel } from './AiPanel'
import { EditableText } from './Editable'

const MARK: Record<Assumption['status'], string> = { untested: '', testing: '', holds: '✓', broken: '✕' }
const RISK_LABEL: Record<Assumption['risk'], string> = { 3: 'Sai thì chết', 2: 'Vừa', 1: 'Thấp' }
const byRisk = (a: Assumption, b: Assumption) => b.risk - a.risk || a.createdAt - b.createdAt
const date = (ts: number) => new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric' }).format(ts)

/** Bằng chứng gắn với một giả định: câu nói của người dùng, một con số, một quan sát. */
function EvidenceFor({ idea, a }: { idea: Idea; a: Assumption }) {
  const [text, setText] = useState('')
  const [signal, setSignal] = useState<Evidence['signal']>('for')
  const mine = idea.evidence.filter((e) => e.assumptionId === a.id)
  const set = (evidence: Evidence[]) => updateIdea(idea.id, { evidence })
  const add = () => {
    const t = text.trim()
    if (!t) return
    set([...idea.evidence, { id: uid(), at: Date.now(), text: t, source: '', signal, assumptionId: a.id }])
    setText('')
  }
  return (
    <div className="q-ev">
      {mine.map((e) => (
        <div key={e.id} className={'q-ev-item ' + e.signal}>
          <p>{e.text}</p>
          <button className="icon-btn small" aria-label="Xoá bằng chứng" onClick={() => set(idea.evidence.filter((x) => x.id !== e.id))}>
            <X size={16} strokeWidth={1.8} />
          </button>
          <span className="q-ev-meta">
            {SIGNALS.find((s) => s.value === e.signal)?.label} · {date(e.at)}
            {e.source ? ` · ${e.source}` : ''}
          </span>
        </div>
      ))}
      <div className="q-add">
        <textarea id={'ev-' + a.id} value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Họ nói gì, hoặc con số đo được? Ví dụ: “Năm ngoái mình mua lều 2 triệu, dùng đúng 1 lần.”" aria-label="Bằng chứng" />
        <div className="q-add-row">
          <div className="mini-seg" role="radiogroup" aria-label="Ủng hộ hay phản bác">
            {SIGNALS.map((s) => (
              <button key={s.value} role="radio" aria-checked={signal === s.value} className={signal === s.value ? 'on' : ''} onClick={() => setSignal(s.value)}>
                {s.label}
              </button>
            ))}
          </div>
          <span className="push" />
          <button className="btn" onClick={add} disabled={!text.trim()}>
            Ghi bằng chứng
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Điều phải đúng thì ý tưởng mới sống. Mỗi điều có kết quả thử và bằng chứng ngay bên trong, không tách thành hai danh sách.
 */
export function Questions({ idea, onCoach }: { idea: Idea; onCoach: () => void }) {
  const [text, setText] = useState('')
  const set = (assumptions: Assumption[]) => updateIdea(idea.id, { assumptions })
  const patch = (id: string, p: Partial<Assumption>) => set(idea.assumptions.map((a) => (a.id === id ? { ...a, ...p } : a)))
  const add = () => {
    const t = text.trim()
    if (!t) return
    set([...idea.assumptions, { id: uid(), text: t, risk: 2, test: '', status: 'untested', createdAt: Date.now() }])
    setText('')
  }
  const known = new Set(idea.assumptions.map((a) => a.id))
  const orphans = idea.evidence.filter((e) => !e.assumptionId || !known.has(e.assumptionId))
  const tested = idea.assumptions.filter((a) => a.status === 'holds' || a.status === 'broken').length

  return (
    <section className="sec" aria-labelledby="q-h">
      <div className="sec-h">
        <h2 id="q-h">Điều phải đúng</h2>
        {idea.assumptions.length > 0 && <span className="num">{tested}/{idea.assumptions.length} đã thử</span>}
      </div>

      {idea.assumptions.length === 0 && (
        <div className="sec-empty">
          <p className="panel-note">
            Điều gì <b>phải đúng</b> thì ý tưởng này mới sống? Ví dụ: “Dân văn phòng chịu trả 200 nghìn để khỏi phải mua lều”. Ghi ra, rồi thử cái rủi ro nhất trước.
          </p>
          <button className="btn" onClick={onCoach}>
            Mài ý tưởng để tìm giúp
          </button>
        </div>
      )}

      {[...idea.assumptions].sort(byRisk).map((a) => (
        <details key={a.id} id={'q-' + a.id} className="q">
          <summary>
            <span className={'q-mark ' + a.status} aria-hidden="true">
              {MARK[a.status]}
            </span>
            <span className="q-text">{a.text}</span>
            <span className={'q-risk r' + a.risk}>{RISK_LABEL[a.risk]}</span>
          </summary>
          <div className="q-body">
            <EditableText className="q-edit" value={a.text} multiline={false} ariaLabel="Giả định" onSave={(v) => (v.trim() ? patch(a.id, { text: v }) : undefined)} />
            <div className="mini-seg" role="radiogroup" aria-label="Kết quả thử">
              {ASSUMPTION_STATUSES.map((s) => (
                <button key={s.value} role="radio" aria-checked={a.status === s.value} className={a.status === s.value ? 'on' : ''} onClick={() => patch(a.id, { status: s.value })}>
                  {s.label}
                </button>
              ))}
            </div>
            <EditableText className="q-edit" value={a.test} ariaLabel="Cách thử" placeholder="Cách thử rẻ nhất trong tuần này: hỏi ai, đăng gì, đo con số nào?" onSave={(v) => patch(a.id, { test: v })} />
            <EvidenceFor idea={idea} a={a} />
            <div className="q-add-row">
              <select className="quiet-select" value={a.risk} onChange={(e) => patch(a.id, { risk: Number(e.target.value) as Assumption['risk'] })} aria-label="Mức rủi ro">
                {RISKS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <span className="push" />
              <button className="text-btn danger" onClick={() => set(idea.assumptions.filter((x) => x.id !== a.id))}>
                Xoá giả định này
              </button>
            </div>
          </div>
        </details>
      ))}

      {orphans.length > 0 && (
        <details className="q">
          <summary>
            <span className="q-mark" aria-hidden="true" />
            <span className="q-text">Bằng chứng chưa gắn với giả định nào</span>
            <span className="q-risk">{orphans.length}</span>
          </summary>
          <div className="q-body">
            {orphans.map((e) => (
              <div key={e.id} className={'q-ev-item ' + e.signal}>
                <p>{e.text}</p>
                <button className="icon-btn small" aria-label="Xoá bằng chứng" onClick={() => updateIdea(idea.id, { evidence: idea.evidence.filter((x) => x.id !== e.id) })}>
                  <X size={16} strokeWidth={1.8} />
                </button>
                <span className="q-ev-meta">
                  {SIGNALS.find((s) => s.value === e.signal)?.label} · {date(e.at)}
                  {e.source ? ` · ${e.source}` : ''}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      <form
        className="add-row q-new"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Thêm một điều phải đúng…" aria-label="Thêm giả định" />
        <button className="btn" type="submit" disabled={!text.trim()}>
          Thêm
        </button>
      </form>

      <AiCritiquePanel idea={idea} />
    </section>
  )
}
