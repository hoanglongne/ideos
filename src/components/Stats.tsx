import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db'
import { iceScore } from '../lib/util'
import { KINDS, STATUSES } from '../types'

const DAY = 86400_000
const dayKey = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export function Stats() {
  const ideas = useLiveQuery(() => db.ideas.toArray(), [])

  const s = useMemo(() => {
    if (!ideas) return null
    const perDay = new Map<string, number>()
    for (const i of ideas) perDay.set(dayKey(i.createdAt), (perDay.get(dayKey(i.createdAt)) ?? 0) + 1)

    // chuỗi ngày liên tiếp có ghi ý tưởng (tính cả hôm qua nếu hôm nay chưa ghi)
    let streak = 0
    let t = Date.now()
    if (!perDay.has(dayKey(t))) t -= DAY
    while (perDay.has(dayKey(t))) {
      streak++
      t -= DAY
    }

    const weeks = 16
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = today.getTime() - ((today.getDay() + 6) % 7) * DAY - (weeks - 1) * 7 * DAY
    const grid = Array.from({ length: weeks }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const ts = start + (w * 7 + d) * DAY
        return { ts, n: ts > Date.now() ? -1 : perDay.get(dayKey(ts)) ?? 0 }
      }),
    )

    const tagCount = new Map<string, number>()
    for (const i of ideas) for (const tg of i.tags) tagCount.set(tg, (tagCount.get(tg) ?? 0) + 1)
    const scored = ideas.map(iceScore).filter((x): x is number => x !== null)

    return {
      total: ideas.length,
      week: ideas.filter((i) => i.createdAt > Date.now() - 7 * DAY).length,
      shipped: ideas.filter((i) => i.status === 'shipped').length,
      streak,
      grid,
      byStatus: STATUSES.map((st) => ({ ...st, n: ideas.filter((i) => i.status === st.value).length })),
      byKind: KINDS.map((k) => ({ ...k, n: ideas.filter((i) => i.kind === k.value).length })),
      topTags: [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
      avgIce: scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : null,
      top: ideas
        .filter((i) => iceScore(i) !== null && i.status !== 'dropped' && i.status !== 'shipped')
        .sort((a, b) => iceScore(b)! - iceScore(a)!)
        .slice(0, 5),
    }
  }, [ideas])

  if (!s) return null
  const maxStatus = Math.max(1, ...s.byStatus.map((x) => x.n))
  const maxKind = Math.max(1, ...s.byKind.map((x) => x.n))

  return (
    <div className="stats">
      <div className="tiles">
        <div className="tile">
          <b>{s.total}</b>
          <span>ý tưởng</span>
        </div>
        <div className="tile">
          <b>{s.week}</b>
          <span>tuần này</span>
        </div>
        <div className="tile">
          <b>🔥 {s.streak}</b>
          <span>ngày liên tiếp</span>
        </div>
        <div className="tile">
          <b>{s.shipped}</b>
          <span>đã ra mắt</span>
        </div>
      </div>

      <h3>Nhịp ghi ý tưởng (16 tuần)</h3>
      <div className="heatmap" role="img" aria-label="Biểu đồ số ý tưởng theo ngày">
        {s.grid.map((col, w) => (
          <div key={w} className="hm-col">
            {col.map((c) => (
              <div
                key={c.ts}
                className="hm-cell"
                data-l={c.n < 0 ? 'x' : Math.min(c.n, 4)}
                title={c.n >= 0 ? `${new Date(c.ts).toLocaleDateString('vi-VN')}: ${c.n} ý tưởng` : ''}
              />
            ))}
          </div>
        ))}
      </div>

      {s.top.length > 0 && (
        <>
          <h3>Nên làm trước (ICE cao nhất)</h3>
          <ol className="top-list">
            {s.top.map((i) => (
              <li key={i.id}>
                <a href={'#/idea/' + i.id}>{i.title}</a> <span className="ice">⚡ {iceScore(i)}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <h3>Theo trạng thái</h3>
      <div className="bars">
        {s.byStatus.map((x) => (
          <div key={x.value} className="bar-row">
            <span className="bar-label">{x.label}</span>
            <div className="bar-track">
              <div className="bar" style={{ width: `${(x.n / maxStatus) * 100}%`, background: x.color }} />
            </div>
            <span className="bar-n">{x.n}</span>
          </div>
        ))}
      </div>

      <h3>Theo loại</h3>
      <div className="bars">
        {s.byKind.map((x) => (
          <div key={x.value} className="bar-row">
            <span className="bar-label">
              {x.emoji} {x.label}
            </span>
            <div className="bar-track">
              <div className="bar" style={{ width: `${(x.n / maxKind) * 100}%` }} />
            </div>
            <span className="bar-n">{x.n}</span>
          </div>
        ))}
      </div>

      {s.topTags.length > 0 && (
        <>
          <h3>Tag hay dùng</h3>
          <div className="chips">
            {s.topTags.map(([t, n]) => (
              <span key={t} className="tag">
                #{t} <span className="muted">{n}</span>
              </span>
            ))}
          </div>
        </>
      )}
      {s.avgIce !== null && <p className="muted small">ICE trung bình: {s.avgIce}</p>}
    </div>
  )
}
