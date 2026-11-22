import { useLiveQuery } from 'dexie-react-hooks'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { db } from '../db'
import { enterDemo } from '../lib/demo'
import { nextStep, stepLabel, todayPlan } from '../lib/journey'
import { matchesQuery, timeAgo } from '../lib/util'
import { STATUSES, type Idea } from '../types'
import { Composer } from './Composer'

const ACTIVE = ['spark', 'exploring', 'validating', 'building']
const stage = (i: Idea) => STATUSES.find((s) => s.value === i.status)!.label

function Item({ idea, hot, sub }: { idea: Idea; hot?: boolean; sub: React.ReactNode }) {
  return (
    <a className={'item row' + (hot ? ' hot' : '')} href={'#/idea/' + idea.id}>
      <span className="item-title row-title">{idea.title || 'Không tiêu đề'}</span>
      <span className="item-sub">{sub}</span>
    </a>
  )
}

/**
 * Trang chủ: ghi ngay ở trên cùng, bên dưới là việc cần bạn làm (tối đa ba), rồi các ý tưởng còn lại.
 * Không thống kê, không biểu đồ, không bộ lọc: ít thứ để nhìn thì mới biết làm gì tiếp.
 */
export function Home({ initialText, focusComposer }: { initialText?: string; focusComposer?: boolean }) {
  const ideas = useLiveQuery(() => db.ideas.toArray(), [])
  const [query, setQuery] = useState('')

  const plan = useMemo(() => (ideas ? todayPlan(ideas, 3) : []), [ideas])
  const rest = useMemo(() => {
    const shown = new Set(plan.map((p) => p.idea.id))
    return (ideas ?? []).filter((i) => ACTIVE.includes(i.status) && !shown.has(i.id)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
  }, [ideas, plan])
  const shelved = useMemo(() => (ideas ?? []).filter((i) => !ACTIVE.includes(i.status)).sort((a, b) => b.updatedAt - a.updatedAt), [ideas])
  const found = useMemo(() => (query.trim() ? (ideas ?? []).filter((i) => matchesQuery(i, query)).sort((a, b) => b.updatedAt - a.updatedAt) : null), [ideas, query])

  if (!ideas) return null

  return (
    <div className="home">
      <Composer initialText={initialText} autoFocus={focusComposer} />

      {ideas.length === 0 ? (
        <div className="first-run">
          <p className="home-lede">Ý tưởng đầu tiên sẽ nằm ở đây.</p>
          <p>Lần tới chợt nghĩ ra gì đó khi đang đi đường, gõ hoặc nói vào ô trên rồi bấm Lưu. Ghi được cả khi không có mạng.</p>
          <ul className="hints">
            <li>Dòng đầu là tiêu đề, các dòng sau là ghi chú.</li>
            <li>
              Gõ <code>#nhãn</code> để gắn nhãn, <code>@app</code> <code>@web</code> <code>@startup</code> để chọn loại.
            </li>
            <li>
              Phím tắt: <kbd>N</kbd> ghi mới, <kbd>/</kbd> tìm, <kbd>Ctrl</kbd> + <kbd>Enter</kbd> lưu.
            </li>
          </ul>
          <p>
            <button className="text-btn" onClick={enterDemo}>
              Xem thử với dữ liệu mẫu
            </button>
          </p>
        </div>
      ) : (
        <>
          {ideas.length > 6 && (
            <label className="search home-search">
              <Search size={18} strokeWidth={1.8} aria-hidden />
              <input type="search" placeholder="Tìm ý tưởng" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Tìm ý tưởng" />
            </label>
          )}

          {found ? (
            <section className="group" aria-labelledby="found-h">
              <div className="group-h">
                <h2 id="found-h">Kết quả</h2>
                <span className="num">{found.length}</span>
              </div>
              {found.length === 0 && <p className="empty-line">Không có ý tưởng nào khớp.</p>}
              {found.map((i) => (
                <Item key={i.id} idea={i} sub={`${stage(i)} · sửa ${timeAgo(i.updatedAt)}`} />
              ))}
            </section>
          ) : (
            <>
              {plan.length > 0 && (
                <section className="group" aria-labelledby="need-h">
                  <div className="group-h">
                    <h2 id="need-h">Cần bạn</h2>
                    <span className="num">{plan.length}</span>
                  </div>
                  {plan.map(({ idea, step }) => (
                    <Item key={idea.id} idea={idea} hot sub={<span className="item-step">{stepLabel(step)}</span>} />
                  ))}
                </section>
              )}

              {rest.length > 0 && (
                <section className="group" aria-labelledby="run-h">
                  <div className="group-h">
                    <h2 id="run-h">Đang chạy</h2>
                    <span className="num">{rest.length}</span>
                  </div>
                  {rest.map((i) => (
                    <Item key={i.id} idea={i} sub={`${stage(i)} · ${stepLabel(nextStep(i)).toLowerCase()}`} />
                  ))}
                </section>
              )}

              {shelved.length > 0 && (
                <details className="group shelf">
                  <summary>
                    <div className="group-h">
                      <h2>Đã cất</h2>
                      <span className="num">{shelved.length}</span>
                    </div>
                  </summary>
                  {shelved.map((i) => (
                    <Item key={i.id} idea={i} sub={`${stage(i)} · sửa ${timeAgo(i.updatedAt)}`} />
                  ))}
                </details>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
