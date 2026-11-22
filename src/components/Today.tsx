import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { db } from '../db'
import { enterDemo } from '../lib/demo'
import { nextStep, stepLabel, todayPlan, type PlanItem } from '../lib/journey'
import { STATUSES, type Idea } from '../types'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const dateLine = () => cap(new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()))
const ACTIVE = ['spark', 'exploring', 'validating', 'building']

/** Một dòng: tên ý tưởng và việc tiếp theo của nó. */
function IdeaLine({ idea }: { idea: Idea }) {
  const stage = STATUSES.find((s) => s.value === idea.status)!.label
  return (
    <a className="row line" href={'#/idea/' + idea.id}>
      <span className="line-main">
        <span className="row-title">{idea.title || 'Không tiêu đề'}</span>
        <span className="line-sub">
          {stage} · {stepLabel(nextStep(idea))}
        </span>
      </span>
      <ChevronRight size={18} strokeWidth={1.6} aria-hidden className="line-go" />
    </a>
  )
}

/** Việc quan trọng nhất hôm nay, nói thẳng và dẫn thẳng tới đó. */
function Hero({ item }: { item: PlanItem }) {
  const { idea, step } = item
  const href = step.kind === 'coach' ? `#/idea/${idea.id}/coach` : `#/idea/${idea.id}`
  return (
    <section className="next-card hero" aria-labelledby="hero-h">
      <p className="eyebrow">Việc quan trọng nhất hôm nay</p>
      <p className="hero-idea">{idea.title || 'Không tiêu đề'}</p>
      <h2 id="hero-h" className="ns-title">
        {step.kind === 'test' ? <span className="ns-quote">{step.title}</span> : stepLabel(step)}
      </h2>
      {step.kind === 'test' && step.risk === 3 && <p className="ns-flag">Sai thì ý tưởng chết, nên thử cái này trước</p>}
      <p className="ns-why">{step.why}</p>
      <div className="ns-actions">
        <a className="btn primary" href={href}>
          {step.kind === 'coach' ? step.cta : 'Mở ý tưởng'}
        </a>
      </div>
    </section>
  )
}

export function Today({ onNew, dueCount }: { onNew: () => void; dueCount: number }) {
  const ideas = useLiveQuery(() => db.ideas.toArray(), [])
  const plan = useMemo(() => (ideas ? todayPlan(ideas, 4) : []), [ideas])
  // ý tưởng đã nằm trong "Việc hôm nay" thì không lặp lại ở danh sách bên dưới
  const running = useMemo(() => {
    const shown = new Set(plan.map((p) => p.idea.id))
    return (ideas ?? []).filter((i) => ACTIVE.includes(i.status) && !shown.has(i.id)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
  }, [ideas, plan])
  if (!ideas) return null

  if (!ideas.length)
    return (
      <div className="today">
        <header className="today-head">
          <p className="today-date">{dateLine()}</p>
          <h1 className="today-title">Ý tưởng đầu tiên sẽ nằm ở đây.</h1>
        </header>
        <div className="first-run">
          <p>Lần tới chợt nghĩ ra gì đó khi đang đi đường, bấm Ghi là lưu được ngay, kể cả khi không có mạng.</p>
          <div className="row-actions">
            <button className="btn primary" onClick={onNew}>
              <Plus size={16} strokeWidth={2} aria-hidden /> Ghi ý tưởng đầu tiên
            </button>
            <button className="text-btn" onClick={enterDemo}>
              Xem thử với dữ liệu mẫu
            </button>
          </div>
          <ul className="hints">
            <li>Dòng đầu là tiêu đề, các dòng sau là ghi chú.</li>
            <li>
              Gõ <code>#tag</code> để gắn nhãn, <code>@app</code> <code>@web</code> <code>@startup</code> để chọn loại.
            </li>
            <li>
              Phím tắt: <kbd>N</kbd> ghi mới, <kbd>/</kbd> tìm, <kbd>Ctrl</kbd> + <kbd>Enter</kbd> lưu.
            </li>
          </ul>
        </div>
      </div>
    )

  const [hero, ...after] = plan
  return (
    <div className="today">
      <header className="today-head">
        <p className="today-date">{dateLine()}</p>
        <h1 className="today-title">Hôm nay</h1>
      </header>

      {hero ? (
        <Hero item={hero} />
      ) : (
        <section className="next-card hero">
          <p className="eyebrow">Hôm nay</p>
          <h2 className="ns-title">Không có việc nào đang chờ</h2>
          <p className="ns-why">Mọi ý tưởng đang để sau hoặc đã ra mắt. Ghi ý tưởng mới, hoặc mở lại một ý tưởng cũ.</p>
          <div className="ns-actions">
            <button className="btn primary" onClick={onNew}>
              <Plus size={16} strokeWidth={2} aria-hidden /> Ghi ý tưởng mới
            </button>
          </div>
        </section>
      )}

      {after.length > 0 && (
        <section className="today-sec" aria-labelledby="then-h">
          <h2 id="then-h" className="today-h">
            Sau đó
          </h2>
          <div className="lines">
            {after.map((p) => (
              <IdeaLine key={p.idea.id} idea={p.idea} />
            ))}
          </div>
        </section>
      )}

      {dueCount > 0 && (
        <a className="review-strip" href="#/review">
          <span>
            <b className="num">{dueCount}</b> ý tưởng lâu chưa xem lại
          </span>
          <span className="review-go">
            Ôn lại <ChevronRight size={16} strokeWidth={1.8} aria-hidden />
          </span>
        </a>
      )}

      <section className="today-sec" aria-labelledby="run-h">
        <div className="today-sec-head">
          <h2 id="run-h" className="today-h">
            Đang chạy
          </h2>
          <a className="head-link" href="#/ideas">
            Xem tất cả {ideas.length} ý tưởng
          </a>
        </div>
        <div className="lines">
          {running.slice(0, 5).map((i) => (
            <IdeaLine key={i.id} idea={i} />
          ))}
          {running.length === 0 && <p className="empty-line">Mọi ý tưởng đang chạy đã nằm ở trên.</p>}
        </div>
      </section>
    </div>
  )
}
