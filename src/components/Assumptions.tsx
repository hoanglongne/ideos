import { X } from 'lucide-react'
import { useState } from 'react'
import { updateIdea } from '../db'
import { uid } from '../lib/util'
import { ASSUMPTION_STATUSES, RISKS, SIGNALS, type Assumption, type Evidence, type Idea } from '../types'
import { EditableText } from './Editable'

const byRisk = (a: Assumption, b: Assumption) => b.risk - a.risk || a.createdAt - b.createdAt

/** Điều phải đúng thì ý tưởng mới sống. Mỗi cái có mức rủi ro, cách thử rẻ nhất và kết quả. */
export function Assumptions({ idea, onCoach }: { idea: Idea; onCoach: () => void }) {
  const [text, setText] = useState('')
  const [risk, setRisk] = useState<Assumption['risk']>(3)
  const set = (assumptions: Assumption[]) => updateIdea(idea.id, { assumptions })
  const patch = (id: string, p: Partial<Assumption>) => set(idea.assumptions.map((a) => (a.id === id ? { ...a, ...p } : a)))

  const add = () => {
    const t = text.trim()
    if (!t) return
    set([...idea.assumptions, { id: uid(), text: t, risk, test: '', status: 'untested', createdAt: Date.now() }])
    setText('')
  }

  return (
    <div className="assumptions">
      {idea.assumptions.length === 0 && (
        <p className="panel-note">
          Điều gì <b>phải đúng</b> thì ý tưởng này mới sống? Ví dụ: "Dân văn phòng chịu trả 200 nghìn để khỏi phải mua lều". Ghi ra những điều đó, rồi thử cái rủi ro nhất trước.{' '}
          <button className="text-btn" onClick={onCoach}>
            Mài ý tưởng để tìm giả định
          </button>
        </p>
      )}
      {[...idea.assumptions].sort(byRisk).map((a) => {
        const ev = idea.evidence.filter((e) => e.assumptionId === a.id)
        const pro = ev.filter((e) => e.signal === 'for').length
        const con = ev.filter((e) => e.signal === 'against').length
        return (
          <div key={a.id} className={'assumption status-' + a.status}>
            <div className="as-head">
              <EditableText className="as-text" value={a.text} multiline={false} ariaLabel="Giả định" onSave={(v) => (v.trim() ? patch(a.id, { text: v }) : undefined)} />
              <button className="icon-btn small" aria-label="Xoá giả định" onClick={() => set(idea.assumptions.filter((x) => x.id !== a.id))}>
                <X size={14} strokeWidth={1.8} />
              </button>
            </div>
            <div className="as-controls">
              <select className="quiet-select" value={a.risk} onChange={(e) => patch(a.id, { risk: Number(e.target.value) as Assumption['risk'] })} aria-label="Mức rủi ro">
                {RISKS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <div className="mini-seg" role="radiogroup" aria-label="Kết quả">
                {ASSUMPTION_STATUSES.map((s) => (
                  <button key={s.value} role="radio" aria-checked={a.status === s.value} className={a.status === s.value ? 'on tone-' + s.tone : ''} onClick={() => patch(a.id, { status: s.value })}>
                    {s.label}
                  </button>
                ))}
              </div>
              {ev.length > 0 && (
                <span className="muted as-ev num">
                  {ev.length} bằng chứng{pro || con ? ` (${[pro && `${pro} ủng hộ`, con && `${con} phản bác`].filter(Boolean).join(', ')})` : ''}
                </span>
              )}
            </div>
            <EditableText className="as-test" value={a.test} ariaLabel="Cách thử" placeholder="Cách thử rẻ nhất trong tuần này: hỏi ai, đăng gì, đo con số nào?" onSave={(v) => patch(a.id, { test: v })} />
          </div>
        )
      })}
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Thêm một điều phải đúng…" aria-label="Thêm giả định" />
        <select value={risk} onChange={(e) => setRisk(Number(e.target.value) as Assumption['risk'])} aria-label="Mức rủi ro của giả định mới">
          {RISKS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <button className="btn" type="submit" disabled={!text.trim()}>
          Thêm
        </button>
      </form>
    </div>
  )
}

const signalTone = (s: Evidence['signal']) => (s === 'for' ? 'tone-positive' : s === 'against' ? 'tone-negative' : 'tone-neutral')
const date = (ts: number) => new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric' }).format(ts)

/** Bằng chứng thật: câu nói của người dùng, một con số, một quan sát. Gắn vào giả định nó chứng minh hoặc bác bỏ. */
export function EvidenceList({ idea }: { idea: Idea }) {
  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [signal, setSignal] = useState<Evidence['signal']>('for')
  const [link, setLink] = useState('')
  const set = (evidence: Evidence[]) => updateIdea(idea.id, { evidence })

  const add = () => {
    const t = text.trim()
    if (!t) return
    set([...idea.evidence, { id: uid(), at: Date.now(), text: t, source: source.trim(), signal, ...(link ? { assumptionId: link } : {}) }])
    setText('')
    setSource('')
  }

  const list = [...idea.evidence].sort((a, b) => b.at - a.at)
  return (
    <div className="evidence">
      {list.length === 0 && <p className="panel-note">Chưa có bằng chứng nào. Sau mỗi lần hỏi ai đó hay thử một điều, ghi lại họ nói gì hoặc con số đo được. Một câu nói thật đáng giá hơn mười lần tự thuyết phục.</p>}
      {list.map((e) => {
        const a = idea.assumptions.find((x) => x.id === e.assumptionId)
        return (
          <figure key={e.id} className="ev">
            <div className="ev-head">
              <span className={'pill ' + signalTone(e.signal)}>{SIGNALS.find((s) => s.value === e.signal)!.label}</span>
              <span className="muted num">{date(e.at)}</span>
              {e.source && <span className="muted">· {e.source}</span>}
              <button className="icon-btn small ev-del" aria-label="Xoá bằng chứng" onClick={() => set(idea.evidence.filter((x) => x.id !== e.id))}>
                <X size={14} strokeWidth={1.8} />
              </button>
            </div>
            <blockquote className="pre">{e.text}</blockquote>
            <select
              className="quiet-select ev-link"
              value={e.assumptionId ?? ''}
              onChange={(ev) => set(idea.evidence.map((x) => (x.id === e.id ? { ...x, assumptionId: ev.target.value || undefined } : x)))}
              aria-label="Gắn với giả định"
            >
              <option value="">Chưa gắn giả định</option>
              {idea.assumptions.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.text.length > 60 ? x.text.slice(0, 58) + '…' : x.text}
                </option>
              ))}
            </select>
            {a && a.status === 'untested' && (
              <button className="text-btn ev-mark" onClick={() => updateIdea(idea.id, { assumptions: idea.assumptions.map((x) => (x.id === a.id ? { ...x, status: 'testing' } : x)) })}>
                Đánh dấu giả định này là đang thử
              </button>
            )}
          </figure>
        )
      })}
      <form
        className="ev-add"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder='Họ nói gì, hoặc con số đo được. Ví dụ: "Năm ngoái mình mua lều 2 triệu, dùng đúng 1 lần."' aria-label="Nội dung bằng chứng" />
        <div className="ev-add-row">
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ai / ở đâu" aria-label="Nguồn" />
          <div className="mini-seg" role="radiogroup" aria-label="Ủng hộ hay phản bác">
            {SIGNALS.map((s) => (
              <button type="button" key={s.value} role="radio" aria-checked={signal === s.value} className={signal === s.value ? 'on ' + signalTone(s.value) : ''} onClick={() => setSignal(s.value)}>
                {s.label}
              </button>
            ))}
          </div>
          {idea.assumptions.length > 0 && (
            <select value={link} onChange={(e) => setLink(e.target.value)} aria-label="Gắn với giả định">
              <option value="">Chưa gắn giả định</option>
              {idea.assumptions.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.text.length > 40 ? x.text.slice(0, 38) + '…' : x.text}
                </option>
              ))}
            </select>
          )}
          <button className="btn" type="submit" disabled={!text.trim()}>
            Ghi bằng chứng
          </button>
        </div>
      </form>
    </div>
  )
}
