import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { db, updateIdea } from '../db'
import { followupQuestion, isFollowup, NEXT_STEP, nextQuestion, sessionLength, shouldFollowUp, type Question } from '../lib/coach'
import { go } from '../lib/router'
import { iceScore, uid } from '../lib/util'
import { CANVAS_FIELDS, SIGNALS, type Assumption, type Evidence, type Idea, type Scores } from '../types'
import { followup, useAi } from '../sync/ai'
import { MediaTools } from './MediaTools'

interface Done {
  q: Question
  summary: string
}

/**
 * Mài ý tưởng: mỗi lần một câu hỏi, câu trả lời đổ thẳng vào chỗ của nó (canvas, giả định, bằng chứng,
 * việc tiếp theo). Câu sau được chọn lại dựa trên trạng thái mới của ý tưởng.
 */
export function Coach({ id }: { id: string }) {
  const idea = useLiveQuery(() => db.ideas.get(id), [id], null)
  const [asked, setAsked] = useState<string[]>([])
  // câu đang hỏi được giữ cố định; chỉ chọn câu mới sau khi câu trả lời đã ghi xong vào DB
  const [current, setCurrent] = useState<Question | null | undefined>(undefined)
  const [done, setDone] = useState<Done[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const logged = useRef(false)
  const { avail, refresh } = useAi()
  const aiReady = avail.state === 'ready' && avail.status.used < avail.status.limit
  // AI đang đọc câu trả lời để đặt câu hỏi tiếp; bấm bỏ qua thì bỏ cuộc chờ
  const [thinking, setThinking] = useState(false)
  const followups = useRef(0)
  const cancelWait = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (idea && total === null) setTotal(sessionLength(idea))
    if (idea && current === undefined) setCurrent(nextQuestion(idea, asked))
  }, [idea, total, current, asked])

  // Rời phiên giữa chừng vẫn ghi lại những gì đã trả lời
  const doneRef = useRef(done)
  doneRef.current = done
  useEffect(
    () => () => {
      if (!logged.current && doneRef.current.length) writeJournal(id, doneRef.current)
    },
    [id],
  )

  if (idea === null) return null
  if (!idea) {
    return (
      <div className="coach">
        <h1 className="page-title">Không tìm thấy ý tưởng này</h1>
      </div>
    )
  }

  const q = finished ? null : (current ?? null)

  const advance = async (summary: string | null) => {
    if (!q) return
    const nextAsked = [...asked, q.id]
    const nextDone = summary ? [...done, { q, summary: isFollowup(q) ? `${q.prompt} — ${summary}` : summary }] : done
    setAsked(nextAsked)
    setDone(nextDone)
    if (q.id === NEXT_STEP.id) {
      setFinished(true)
      logged.current = true
      if (nextDone.length) writeJournal(id, nextDone)
      return
    }
    const fresh = await db.ideas.get(id)
    if (fresh && summary && shouldFollowUp(q, summary, followups.current, aiReady)) {
      setThinking(true)
      const next = await Promise.race<string | null>([
        followup(fresh, q.prompt, summary).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 9000)),
        new Promise<null>((resolve) => (cancelWait.current = () => resolve(null))),
      ])
      cancelWait.current = null
      setThinking(false)
      refresh()
      if (next) {
        followups.current += 1
        setCurrent(followupQuestion(followups.current, next))
        return
      }
    }
    setCurrent(fresh ? nextQuestion(fresh, nextAsked) : null)
  }

  // câu hỏi tiếp của AI không tính vào "Câu X trên N"
  const step = asked.filter((x) => !isFollowup({ id: x })).length + 1

  return (
    <div className="coach">
      <div className="coach-bar">
        <a className="btn ghost" href={`#/idea/${id}`}>
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden /> {finished ? 'Về ý tưởng' : 'Thoát'}
        </a>
        {!finished && total !== null && (
          <span className="coach-progress num" aria-label={`Câu ${step} trên khoảng ${Math.max(total, step)}`}>
            Câu {step} trên {Math.max(total, step)}
            <span className="progress-track" aria-hidden="true">
              <span style={{ width: `${(step / Math.max(total, step)) * 100}%` }} />
            </span>
          </span>
        )}
      </div>
      <h1 className="coach-idea">{idea.title}</h1>

      <div className="coach-grid">
      {thinking ? (
        <section className="coach-q" aria-live="polite">
          <p className="coach-prompt coach-thinking">AI đang đọc câu trả lời của bạn…</p>
          <p className="coach-hint">Nếu còn chung chung, AI sẽ hỏi thêm một câu để đào sâu. Không muốn chờ thì cứ bỏ qua.</p>
          <div className="coach-actions">
            <span className="push" />
            <button type="button" className="text-btn" onClick={() => cancelWait.current?.()}>
              Bỏ qua
            </button>
          </div>
        </section>
      ) : q ? (
        <QuestionStep key={q.id} q={q} idea={idea} onDone={advance} />
      ) : (
        current !== undefined && (
          <Summary
            idea={idea}
            done={done}
            onMore={() => {
              setAsked([])
              setDone([])
              setTotal(null)
              setCurrent(undefined)
              setFinished(false)
              logged.current = false
              followups.current = 0
            }}
          />
        )
      )}
        {!finished && (
          <aside className="panel coach-side" aria-labelledby="session-h">
            <div className="panel-head">
              <h2 id="session-h">Phiên này</h2>
              {done.length > 0 && <span className="muted num">{done.length} câu trả lời</span>}
            </div>
            {done.length ? (
              <dl className="coach-log">
                {done.map((d) => (
                  <div key={d.q.id}>
                    <dt>{shortLabel(d.q)}</dt>
                    <dd>{d.summary}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="panel-note">Mỗi câu trả lời tự vào đúng chỗ của nó trong ý tưởng: canvas, giả định, bằng chứng hay bước tiếp theo. Cả phiên được ghi vào nhật ký khi xong.</p>
            )}
            <p className="panel-note coach-state">
              Ý tưởng hiện có <span className="num">{CANVAS_FIELDS.filter((f) => idea.canvas[f.key].trim()).length}/6</span> ô canvas, <span className="num">{idea.assumptions.length}</span> giả định,{' '}
              <span className="num">{idea.evidence.length}</span> bằng chứng.
            </p>
          </aside>
        )}
      </div>
    </div>
  )
}

function writeJournal(ideaId: string, done: Done[]) {
  const text = done.map((d) => `${shortLabel(d.q)}: ${d.summary}`).join('\n')
  db.transaction('rw', db.ideas, async () => {
    const idea = await db.ideas.get(ideaId)
    if (!idea) return
    await db.ideas.update(ideaId, { journal: [...idea.journal, { id: uid(), at: Date.now(), kind: 'coach', text }], updatedAt: Date.now() })
  })
}

function shortLabel(q: Question) {
  const t = q.target
  if (t.type === 'canvas') return CANVAS_FIELDS.find((f) => f.key === t.key)!.label
  if (t.type === 'journal') return t.label
  return { assumptions: 'Giả định', riskiest: 'Phép thử', evidence: 'Bằng chứng', scores: 'Điểm ICE', task: 'Việc 48 giờ' }[t.type]
}

/* ---------- một câu hỏi ---------- */

function QuestionStep({ q, idea, onDone }: { q: Question; idea: Idea; onDone: (summary: string | null) => void }) {
  const t = q.target
  return (
    <section className="coach-q" aria-labelledby="coach-prompt">
      <p id="coach-prompt" className="coach-prompt">
        {q.prompt}
      </p>
      <p className="coach-hint">{q.hint}</p>
      {t.type === 'riskiest' ? (
        <RiskiestAnswer idea={idea} onDone={onDone} />
      ) : t.type === 'evidence' ? (
        <EvidenceAnswer idea={idea} onDone={onDone} />
      ) : t.type === 'scores' ? (
        <ScoresAnswer idea={idea} onDone={onDone} />
      ) : (
        <TextAnswer
          idea={idea}
          multiline={t.type !== 'task'}
          placeholder={t.type === 'assumptions' ? 'Mỗi dòng một điều phải đúng' : t.type === 'task' ? 'Ví dụ: Nhắn cho chị Lan hỏi chị thuê lều ở đâu' : 'Trả lời thoải mái, sửa lại sau cũng được'}
          onSubmit={async (text) => {
            if (t.type === 'canvas') {
              const cur = idea.canvas[t.key].trim()
              await updateIdea(idea.id, { [`canvas.${t.key}`]: cur ? `${cur}\n${text}` : text })
              return onDone(text)
            }
            if (t.type === 'assumptions') {
              const lines = text.split('\n').map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean)
              const now = Date.now()
              const added: Assumption[] = lines.map((l, k) => ({ id: uid(), text: l, risk: 2, test: '', status: 'untested', createdAt: now + k }))
              await updateIdea(idea.id, { assumptions: [...idea.assumptions, ...added] })
              return onDone(lines.join('; '))
            }
            if (t.type === 'task') {
              await updateIdea(idea.id, { tasks: [...idea.tasks, { id: uid(), text, done: false }] })
              return onDone(text)
            }
            // journal: câu trả lời được ghi vào nhật ký ở cuối phiên
            return onDone(text)
          }}
          onSkip={() => onDone(null)}
        />
      )}
    </section>
  )
}

function TextAnswer({
  idea,
  multiline,
  placeholder,
  onSubmit,
  onSkip,
}: {
  idea: Idea
  multiline: boolean
  placeholder: string
  onSubmit: (text: string) => void
  onSkip: () => void
}) {
  const [v, setV] = useState('')
  const [interim, setInterim] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => ref.current?.focus(), [])
  const appendText = useCallback((t: string) => setV((cur) => (cur && !/\s$/.test(cur) ? cur + ' ' : cur) + t), [])
  const submit = () => v.trim() && onSubmit(v.trim())
  return (
    <form
      className="coach-answer"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <textarea
        ref={ref}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !multiline)) {
            e.preventDefault()
            submit()
          }
        }}
        rows={multiline ? 5 : 2}
        placeholder={placeholder}
        aria-label="Câu trả lời"
      />
      {interim && <div className="interim">{interim}</div>}
      <div className="coach-actions">
        <MediaTools onText={appendText} onInterim={setInterim} onAttach={(a) => db.attachments.add({ ...a, id: uid(), ideaId: idea.id, createdAt: Date.now() })} />
        <span className="push" />
        <button type="button" className="text-btn" onClick={onSkip}>
          Bỏ qua
        </button>
        <button className="btn primary" disabled={!v.trim()}>
          Tiếp
        </button>
      </div>
    </form>
  )
}

function RiskiestAnswer({ idea, onDone }: { idea: Idea; onDone: (s: string | null) => void }) {
  const [pick, setPick] = useState(() => [...idea.assumptions].sort((a, b) => b.risk - a.risk)[0]?.id ?? '')
  const [test, setTest] = useState('')
  const submit = async () => {
    const a = idea.assumptions.find((x) => x.id === pick)
    if (!a || !test.trim()) return
    await updateIdea(idea.id, { assumptions: idea.assumptions.map((x) => (x.id === pick ? { ...x, risk: 3, test: test.trim(), status: x.status === 'untested' ? 'testing' : x.status } : x)) })
    onDone(`"${a.text}", thử bằng: ${test.trim()}`)
  }
  return (
    <form
      className="coach-answer"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="pick-list" role="radiogroup" aria-label="Giả định rủi ro nhất">
        {idea.assumptions.map((a) => (
          <button type="button" key={a.id} role="radio" aria-checked={pick === a.id} className={'pick' + (pick === a.id ? ' on' : '')} onClick={() => setPick(a.id)}>
            {a.text}
          </button>
        ))}
      </div>
      <textarea value={test} onChange={(e) => setTest(e.target.value)} rows={3} placeholder="Phép thử: hỏi ai, đăng gì, đo con số nào" aria-label="Phép thử" />
      <div className="coach-actions">
        <span className="push" />
        <button type="button" className="text-btn" onClick={() => onDone(null)}>
          Bỏ qua
        </button>
        <button className="btn primary" disabled={!pick || !test.trim()}>
          Tiếp
        </button>
      </div>
    </form>
  )
}

function EvidenceAnswer({ idea, onDone }: { idea: Idea; onDone: (s: string | null) => void }) {
  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [signal, setSignal] = useState<Evidence['signal']>('for')
  const submit = async () => {
    if (!text.trim()) return
    await updateIdea(idea.id, { evidence: [...idea.evidence, { id: uid(), at: Date.now(), text: text.trim(), source: source.trim(), signal }] })
    onDone(`"${text.trim()}"${source.trim() ? ` (${source.trim()})` : ''}`)
  }
  return (
    <form
      className="coach-answer"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Họ nói gì? Ghi đúng lời họ" aria-label="Lời họ nói" autoFocus />
      <div className="ev-add-row">
        <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ai / ở đâu" aria-label="Nguồn" />
        <div className="mini-seg" role="radiogroup" aria-label="Ủng hộ hay phản bác">
          {SIGNALS.map((s) => (
            <button type="button" key={s.value} role="radio" aria-checked={signal === s.value} className={signal === s.value ? 'on' : ''} onClick={() => setSignal(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="coach-actions">
        <span className="push" />
        <button type="button" className="text-btn" onClick={() => onDone(null)}>
          Chưa hỏi ai
        </button>
        <button className="btn primary" disabled={!text.trim()}>
          Tiếp
        </button>
      </div>
    </form>
  )
}

const SCORE_LABELS: { key: keyof Scores; label: string; low: string; high: string }[] = [
  { key: 'impact', label: 'Tác động', low: 'nhỏ', high: 'thay đổi cuộc chơi' },
  { key: 'confidence', label: 'Tự tin', low: 'đoán mò', high: 'có bằng chứng' },
  { key: 'ease', label: 'Dễ làm', low: 'vài tháng', high: 'vài ngày' },
]

function ScoresAnswer({ idea, onDone }: { idea: Idea; onDone: (s: string | null) => void }) {
  const [s, setS] = useState<Scores>(() => ({ impact: idea.scores.impact || 5, confidence: idea.scores.confidence || 5, ease: idea.scores.ease || 5 }))
  const submit = async () => {
    await updateIdea(idea.id, { scores: s })
    onDone(`${iceScore({ scores: s })!.toFixed(1)} (tác động ${s.impact}, tự tin ${s.confidence}, dễ làm ${s.ease})`)
  }
  return (
    <form
      className="coach-answer"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {SCORE_LABELS.map((f) => (
        <label key={f.key} className="coach-score">
          <span className="coach-score-name">
            {f.label} <b className="num">{s[f.key]}</b>
          </span>
          <input type="range" min={1} max={10} value={s[f.key]} onChange={(e) => setS({ ...s, [f.key]: +e.target.value })} aria-label={f.label} />
          <span className="coach-score-ends muted">
            <span>{f.low}</span>
            <span>{f.high}</span>
          </span>
        </label>
      ))}
      <div className="coach-actions">
        <span className="muted">
          ICE <b className="num ice-figure">{iceScore({ scores: s })!.toFixed(1)}</b>
        </span>
        <span className="push" />
        <button type="button" className="text-btn" onClick={() => onDone(null)}>
          Bỏ qua
        </button>
        <button className="btn primary">Tiếp</button>
      </div>
    </form>
  )
}

/* ---------- tổng kết ---------- */

function Summary({ idea, done, onMore }: { idea: Idea; done: Done[]; onMore: () => void }) {
  return (
    <section className="coach-q" aria-labelledby="coach-done">
      <h2 id="coach-done" className="coach-prompt">
        {done.length ? 'Ý tưởng đã sắc hơn một chút.' : 'Lần này bạn bỏ qua hết.'}
      </h2>
      {done.length > 0 ? (
        <>
          <p className="coach-hint">Những câu trả lời đã vào đúng chỗ trong ý tưởng, và cả phiên được ghi vào nhật ký.</p>
          <dl className="coach-summary">
            {done.map((d) => (
              <div key={d.q.id}>
                <dt>{shortLabel(d.q)}</dt>
                <dd className="pre">{d.summary}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="coach-hint">Không sao. Quay lại khi có thêm thông tin, hoặc ghi vài dòng vào nhật ký trước.</p>
      )}
      <div className="coach-actions">
        <button className="btn primary" onClick={() => go(`/idea/${idea.id}`)}>
          Về ý tưởng
        </button>
        <button className="btn" onClick={onMore}>
          Mài thêm
        </button>
      </div>
    </section>
  )
}
