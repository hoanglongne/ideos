import { updateIdea } from '../db'
import type { Step } from '../lib/journey'
import { ASSUMPTION_STATUSES, type Idea } from '../types'

/** Mở một mục có id rồi cuộn tới nó. */
export function reveal(id: string, focusId?: string) {
  const el = document.getElementById(id) as HTMLDetailsElement | null
  if (!el) return
  if ('open' in el) el.open = true
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ block: 'start', behavior: calm ? 'auto' : 'smooth' })
  if (focusId) setTimeout(() => document.getElementById(focusId)?.focus({ preventScroll: true }), calm ? 0 : 350)
}

/**
 * "Bây giờ": việc duy nhất bạn nên làm với ý tưởng này, nói bằng một câu và làm được ngay tại đây.
 * Thử giả định thì chọn kết quả luôn; việc thì đánh dấu xong; quyết định thì chọn đi tiếp / để sau / bỏ.
 */
export function Now({ idea, step, summary, onStatus }: { idea: Idea; step: Step; summary: string; onStatus: (s: Idea['status']) => void }) {
  const setAssumption = (status: Idea['assumptions'][number]['status']) =>
    updateIdea(idea.id, { assumptions: idea.assumptions.map((a) => (a.id === step.assumptionId ? { ...a, status } : a)) })
  const doneTask = () => updateIdea(idea.id, { tasks: idea.tasks.map((t) => (t.id === step.taskId ? { ...t, done: true } : t)) })

  return (
    <section className={'now kind-' + step.kind} aria-labelledby="now-h">
      <p className="eyebrow">Bây giờ</p>
      <h2 id="now-h" className="now-title">
        {step.kind === 'test' ? <span className="now-quote">{step.title}</span> : step.title}
      </h2>
      {step.kind === 'test' && step.risk === 3 && <p className="now-flag">Sai thì ý tưởng chết, nên thử cái này trước</p>}
      <p className="now-why">{step.why}</p>

      {step.kind === 'decide' && (
        <>
          <p className="now-result">{summary}</p>
          <div className="now-actions">
            <button className="btn primary" onClick={() => onStatus('building')}>
              Đi tiếp: bắt đầu làm
            </button>
            <button className="btn" onClick={() => onStatus('parked')}>
              Để sau
            </button>
            <button className="text-btn" onClick={() => onStatus('dropped')}>
              Bỏ ý tưởng
            </button>
          </div>
        </>
      )}

      {step.kind === 'revisit' && (
        <div className="now-actions">
          <button className="btn primary" onClick={() => updateIdea(idea.id, { reviewedAt: Date.now() })}>
            {step.cta}
          </button>
          <button className="btn" onClick={() => onStatus('parked')}>
            Để sau
          </button>
          <button className="text-btn" onClick={() => onStatus('dropped')}>
            Bỏ ý tưởng
          </button>
        </div>
      )}

      {step.kind === 'coach' && (
        <div className="now-actions">
          <a className="btn primary" href={`#/idea/${idea.id}/coach`}>
            {step.cta}
          </a>
        </div>
      )}

      {step.kind === 'task' && (
        <div className="now-actions">
          <button className="btn primary" onClick={doneTask}>
            {step.cta}
          </button>
          <button className="text-btn" onClick={() => reveal('sec-tasks')}>
            Xem cả danh sách
          </button>
        </div>
      )}

      {step.kind === 'test' && (
        <>
          <div className="now-actions">
            <button className="btn primary" onClick={() => reveal('q-' + step.assumptionId, 'ev-' + step.assumptionId)}>
              {step.cta}
            </button>
          </div>
          <div className="now-result" role="group" aria-label="Kết quả thử">
            <span>Kết quả:</span>
            <div className="mini-seg">
              {ASSUMPTION_STATUSES.filter((s) => s.value !== 'untested').map((s) => (
                <button key={s.value} onClick={() => setAssumption(s.value)}>
                  {s.value === 'testing' ? 'Đang thử' : s.value === 'holds' ? 'Đúng' : 'Sai'}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {(step.kind === 'advance' || step.kind === 'ship' || step.kind === 'resume') && step.advanceTo && (
        <div className="now-actions">
          <button className="btn primary" onClick={() => onStatus(step.advanceTo!)}>
            {step.cta}
          </button>
        </div>
      )}

      {(step.kind === 'money' || step.kind === 'track') && (
        <div className="now-actions">
          <button className="btn primary" onClick={() => reveal('sec-money')}>
            {step.cta}
          </button>
        </div>
      )}
    </section>
  )
}
