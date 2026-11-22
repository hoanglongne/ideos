import { type Step } from '../lib/journey'
import { suggestConfidence } from '../lib/insight'
import { ASSUMPTION_STATUSES, type Idea } from '../types'
import { updateIdea } from '../db'
import { IceScorer } from './IdeaParts'

/**
 * Bước tiếp theo, nói thẳng và làm được ngay tại đây: một câu, một nút chính.
 * Thử giả định thì chọn kết quả luôn; việc thì đánh dấu xong; quyết định thì chấm điểm và chọn đi tiếp / để sau / bỏ.
 */
export function NextStepCard({
  idea,
  step,
  onStatus,
  onOpen,
}: {
  idea: Idea
  step: Step
  onStatus: (s: Idea['status']) => void
  onOpen: (section: string) => void
}) {
  const setAssumption = (status: Idea['assumptions'][number]['status']) =>
    updateIdea(idea.id, { assumptions: idea.assumptions.map((a) => (a.id === step.assumptionId ? { ...a, status } : a)) })
  const doneTask = () => updateIdea(idea.id, { tasks: idea.tasks.map((t) => (t.id === step.taskId ? { ...t, done: true } : t)) })

  return (
    <section className={'next-card kind-' + step.kind} aria-labelledby="ns-h">
      <p className="eyebrow">Bước tiếp theo</p>
      <h2 id="ns-h" className="ns-title">
        {step.kind === 'test' ? <span className="ns-quote">{step.title}</span> : step.title}
      </h2>
      {step.kind === 'test' && step.risk === 3 && <p className="ns-flag">Sai thì ý tưởng chết, nên thử cái này trước</p>}
      <p className="ns-why">{step.why}</p>

      {step.kind === 'decide' ? (
        <div className="ns-decide">
          <IceScorer scores={idea.scores} hint={suggestConfidence(idea)} onChange={(key, v) => updateIdea(idea.id, { [`scores.${key}`]: v })} />
          <div className="ns-actions">
            <button className="btn primary" onClick={() => onStatus('building')}>
              Đi tiếp: bắt đầu làm
            </button>
            <button className="btn" onClick={() => onStatus('parked')}>
              Để sau
            </button>
            <button className="text-btn danger" onClick={() => onStatus('dropped')}>
              Bỏ ý tưởng
            </button>
          </div>
        </div>
      ) : (
        <div className="ns-actions">
          {step.kind === 'coach' ? (
            <a className="btn primary" href={`#/idea/${idea.id}/coach`}>
              {step.cta}
            </a>
          ) : step.kind === 'task' ? (
            <>
              <button className="btn primary" onClick={doneTask}>
                {step.cta}
              </button>
              <button className="text-btn" onClick={() => onOpen('tasks')}>
                Xem cả danh sách
              </button>
            </>
          ) : step.advanceTo ? (
            <button className="btn primary" onClick={() => onStatus(step.advanceTo!)}>
              {step.cta}
            </button>
          ) : (
            <button className="btn primary" onClick={() => onOpen(step.kind === 'test' ? 'evidence' : (step.section ?? 'journal'))}>
              {step.cta}
            </button>
          )}
          {step.kind === 'test' && (
            <div className="ns-result-wrap">
              <span className="ns-result-label">Giả định này:</span>
              <div className="mini-seg ns-result" role="group" aria-label="Kết quả thử">
                {ASSUMPTION_STATUSES.filter((s) => s.value !== 'untested').map((s) => (
                  <button key={s.value} onClick={() => setAssumption(s.value)}>
                    {s.value === 'testing' ? 'Đang thử' : s.value === 'holds' ? 'Đúng' : 'Sai'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
