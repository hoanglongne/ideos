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
  const weeksLabel = s.grid[0]?.[0] ? new Date(s.grid[0][0].ts).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' }) : ''

  return (
    <div className="stats">
      <header className="title-row">
        <div className="title-text">
          <h1 className="page-title">Thống kê</h1>
          <p className="lede">
            {s.total ? (
              <>
                {s.streak > 1 ? `Đang có chuỗi ${s.streak} ngày liền ghi ý tưởng.` : s.week ? `${s.week} ý tưởng trong 7 ngày qua.` : 'Chưa ghi ý tưởng nào trong 7 ngày qua.'}
                {s.avgIce !== null && ` ICE trung bình ${s.avgIce.toFixed(1)}.`}
              </>
            ) : (
              'Số liệu sẽ có khi bạn ghi ý tưởng đầu tiên.'
            )}
          </p>
        </div>
      </header>

      <section className="kpis" aria-label="Tổng quan">
        <div className="kpi">
          <span className="kpi-label">Tổng số ý tưởng</span>
          <span className="kpi-value num">{s.total}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">7 ngày qua</span>
          <span className="kpi-value num">{s.week}</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Chuỗi ngày ghi</span>
          <span className="kpi-value num">
            {s.streak}
            <small> ngày</small>
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Đã ra mắt</span>
          <span className="kpi-value num">{s.shipped}</span>
        </div>
      </section>

      <div className="stats-grid">
        <section className="panel heat-panel" aria-labelledby="heat-h">
          <div className="panel-head">
            <h2 id="heat-h">Nhịp ghi 16 tuần</h2>
            <span className="muted">từ {weeksLabel}</span>
          </div>
          <div className="heatmap" role="img" aria-label={`Số ý tưởng mỗi ngày trong 16 tuần, tổng ${s.grid.flat().reduce((a, c) => a + Math.max(0, c.n), 0)}`}>
            {s.grid.map((col, w) => (
              <div key={w} className="hm-col">
                {col.map((c) => (
                  <div key={c.ts} className="hm-cell" data-l={c.n < 0 ? 'x' : Math.min(c.n, 4)} title={c.n >= 0 ? `${new Date(c.ts).toLocaleDateString('vi-VN')}: ${c.n} ý tưởng` : ''} />
                ))}
              </div>
            ))}
          </div>
          <p className="heat-key muted">
            Ít <span className="hm-cell" data-l="0" /> <span className="hm-cell" data-l="1" /> <span className="hm-cell" data-l="2" /> <span className="hm-cell" data-l="3" /> <span className="hm-cell" data-l="4" /> 4+ mỗi ngày
          </p>
        </section>

        <section className="panel" aria-labelledby="top-ice-h">
          <div className="panel-head">
            <h2 id="top-ice-h">Nên làm trước</h2>
            <span className="muted">theo ICE</span>
          </div>
          {s.top.length ? (
            <ol className="mini-list ranked">
              {s.top.map((i) => (
                <li key={i.id}>
                  <a href={'#/idea/' + i.id}>{i.title}</a>
                  <span className="num ice-figure">{iceScore(i)!.toFixed(1)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="panel-note">Chưa có ý tưởng đang sống nào được chấm đủ 3 mục ICE.</p>
          )}
        </section>

        <section className="panel" aria-labelledby="by-status-h">
          <div className="panel-head">
            <h2 id="by-status-h">Theo giai đoạn</h2>
          </div>
          <BarList rows={s.byStatus.map((x) => ({ key: x.value, label: x.label, n: x.n, tone: x.value === 'shipped' ? 'positive' : x.tone }))} max={maxStatus} total={s.total} />
        </section>

        <section className="panel" aria-labelledby="by-kind-h">
          <div className="panel-head">
            <h2 id="by-kind-h">Theo loại</h2>
          </div>
          <BarList rows={s.byKind.map((x) => ({ key: x.value, label: x.label, n: x.n }))} max={maxKind} total={s.total} />
          <p className="panel-note bar-note">
            Gõ <code>@app</code>, <code>@web</code> hay <code>@startup</code> khi ghi để chọn loại nhanh.
          </p>
        </section>

        <section className="panel tags-panel" aria-labelledby="tags-h">
          <div className="panel-head">
            <h2 id="tags-h">Tag hay dùng</h2>
          </div>
          {s.topTags.length ? (
            <p className="tag-cloud">
              {s.topTags.map(([t, n]) => (
                <span key={t} className="tag">
                  #{t} <span className="num muted">{n}</span>
                </span>
              ))}
            </p>
          ) : (
            <p className="panel-note">Gõ #tag khi ghi để gom các ý tưởng cùng chủ đề.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function BarList({ rows, max, total }: { rows: { key: string; label: string; n: number; tone?: string }[]; max: number; total: number }) {
  return (
    <ul className="bar-list">
      {rows.map((r) => (
        <li key={r.key}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track" aria-hidden="true">
            {r.n > 0 && <span className={'bar' + (r.tone ? ' tone-' + r.tone : '')} style={{ width: `${(r.n / max) * 100}%` }} />}
          </span>
          <span className={'bar-n num' + (r.n ? '' : ' none')}>{r.n}</span>
        </li>
      ))}
      <li className="bar-total">
        <span className="bar-label">Tổng</span>
        <span />
        <span className="bar-n num">{total}</span>
      </li>
    </ul>
  )
}
