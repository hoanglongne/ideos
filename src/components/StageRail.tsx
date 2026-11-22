import { STAGES, stageIndex } from '../lib/journey'
import type { IdeaStatus } from '../types'

/** Thanh hành trình: ý tưởng đang ở chặng nào. Chặng đã qua đặc, chặng hiện tại có nhãn rõ, chặng sau mờ. */
export function StageRail({ status }: { status: IdeaStatus }) {
  const cur = stageIndex(status)
  if (cur < 0)
    return (
      <p className="rail-off">
        {status === 'parked' ? 'Đang để sau' : 'Đã bỏ'}
      </p>
    )
  return (
    <ol className="rail" aria-label={`Hành trình: đang ở chặng ${STAGES[cur].label}`}>
      {STAGES.map((s, k) => (
        <li key={s.status} className={k < cur ? 'done' : k === cur ? 'current' : ''} aria-current={k === cur ? 'step' : undefined}>
          <span className="rail-dot" aria-hidden="true" />
          <span className="rail-label">{s.label}</span>
        </li>
      ))}
    </ol>
  )
}
