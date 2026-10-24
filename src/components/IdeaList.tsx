import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search } from 'lucide-react'
import { useMemo, useState, type RefObject } from 'react'
import { db } from '../db'
import { enterDemo } from '../lib/demo'
import { useSettings } from '../lib/settings'
import { iceScore, matchesQuery } from '../lib/util'
import { KINDS, REVIEWABLE, STATUSES, type Idea, type IdeaKind, type IdeaStatus } from '../types'
import { IdeaRow } from './IdeaRow'

type Sort = 'created' | 'updated' | 'score' | 'title'
type StageFilter = IdeaStatus | 'active' | 'shelved' | 'all'

const SORTS: Record<Sort, (a: Idea, b: Idea) => number> = {
  created: (a, b) => b.createdAt - a.createdAt,
  updated: (a, b) => b.updatedAt - a.updatedAt,
  score: (a, b) => (iceScore(b) ?? -1) - (iceScore(a) ?? -1) || b.createdAt - a.createdAt,
  title: (a, b) => a.title.localeCompare(b.title, 'vi'),
}

const ACTIVE: IdeaStatus[] = ['spark', 'exploring', 'validating', 'building']
const SHELVED: IdeaStatus[] = ['parked', 'dropped']
const DAY = 86400_000

const inStage = (i: Idea, f: StageFilter) =>
  f === 'all' || (f === 'active' ? ACTIVE.includes(i.status) : f === 'shelved' ? SHELVED.includes(i.status) : i.status === f)

const loadPref = <T,>(key: string, def: T): T => {
  try {
    const v = sessionStorage.getItem('ideos.' + key)
    return v ? (JSON.parse(v) as T) : def
  } catch {
    return def
  }
}
const savePref = (key: string, v: unknown) => {
  try {
    sessionStorage.setItem('ideos.' + key, JSON.stringify(v))
  } catch {
    /* bỏ qua */
  }
}

function usePref<T>(key: string, def: T) {
  const [v, setV] = useState<T>(() => loadPref(key, def))
  return [v, (nv: T) => (setV(nv), savePref(key, nv))] as const
}

const weekday = () => new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(new Date())
const dateLine = () => new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'long' }).format(new Date())
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function IdeaList({
  query,
  onQuery,
  searchRef,
  onNew,
  dueCount,
}: {
  query: string
  onQuery: (q: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  onNew: () => void
  dueCount: number
}) {
  const ideas = useLiveQuery(() => db.ideas.toArray(), [])
  const attCounts = useLiveQuery(async () => {
    const m = new Map<string, number>()
    await db.attachments.each((a) => m.set(a.ideaId, (m.get(a.ideaId) ?? 0) + 1))
    return m
  }, [])
  const { reviewAfterDays } = useSettings()
  const [stage, setStage] = usePref<StageFilter>('stage', 'active')
  const [kind, setKind] = usePref<IdeaKind | 'all'>('kind', 'all')
  const [tag, setTag] = usePref<string | null>('tag', null)
  const [sort, setSort] = usePref<Sort>('sort', 'created')

  const allTags = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of ideas ?? []) for (const t of i.tags) m.set(t, (m.get(t) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [ideas])

  const list = useMemo(() => {
    if (!ideas) return []
    const filtered = ideas.filter((i) => inStage(i, stage) && (kind === 'all' || i.kind === kind) && (!tag || i.tags.includes(tag)) && matchesQuery(i, query))
    return filtered.sort((a, b) => Number(b.pinned) - Number(a.pinned) || SORTS[sort](a, b))
  }, [ideas, stage, kind, tag, sort, query])

  const side = useMemo(() => {
    if (!ideas) return null
    const cutoff = Date.now() - reviewAfterDays * DAY
    const due = ideas
      .filter((i) => REVIEWABLE.includes(i.status) && (i.reviewedAt ?? i.createdAt) < cutoff)
      .sort((a, b) => (a.reviewedAt ?? a.createdAt) - (b.reviewedAt ?? b.createdAt))
    const top = ideas
      .filter((i) => iceScore(i) !== null && ACTIVE.includes(i.status))
      .sort((a, b) => iceScore(b)! - iceScore(a)!)
      .slice(0, 4)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const week = Array.from({ length: 7 }, (_, k) => {
      const start = today.getTime() - (6 - k) * DAY
      return { start, n: ideas.filter((i) => i.createdAt >= start && i.createdAt < start + DAY).length }
    })
    return { due: due.slice(0, 4), top, week }
  }, [ideas, reviewAfterDays])

  if (!ideas) return null

  const weekCount = ideas.filter((i) => i.createdAt > Date.now() - 7 * DAY).length
  const alive = ideas.filter((i) => ACTIVE.includes(i.status)).length
  const shipped = ideas.filter((i) => i.status === 'shipped').length
  const greeting = !ideas.length
    ? 'Ý tưởng đầu tiên sẽ nằm ở đây.'
    : weekCount
      ? `${cap(weekday())}, ${weekCount} ý tưởng mới tuần này.`
      : `${cap(weekday())}, tuần này chưa có ý tưởng mới.`
  const filtered = stage !== 'all' || kind !== 'all' || !!tag || !!query.trim()

  return (
    <div className="home">
      <header className="title-row">
        <div className="title-text">
          <h1 className="greeting">{greeting}</h1>
          <p className="lede">
            {cap(dateLine())}
            {ideas.length > 0 && (
              <>
                {' · '}
                {alive} đang sống{shipped ? `, ${shipped} đã ra mắt` : ''}
              </>
            )}
            {dueCount > 0 && (
              <>
                {' · '}
                <a href="#/review" className="lede-link">
                  {dueCount} ý tưởng chờ ôn lại
                </a>
              </>
            )}
          </p>
        </div>
      </header>

      <Pipeline ideas={ideas} stage={stage} onStage={setStage} />

      <div className="home-grid">
        <section className={'panel list-panel' + (ideas.length ? '' : ' full')} aria-labelledby="list-h">
          <div className="panel-head">
            <h2 id="list-h">{stageTitle(stage)}</h2>
            <span className="muted num">{list.length}</span>
          </div>
          <div className="toolbar">
            <label className="search">
              <Search size={15} strokeWidth={1.8} aria-hidden />
              <input ref={searchRef} type="search" placeholder="Tìm theo chữ hoặc #tag" value={query} onChange={(e) => onQuery(e.target.value)} aria-label="Tìm ý tưởng" />
            </label>
            <select value={kind} onChange={(e) => setKind(e.target.value as IdeaKind | 'all')} aria-label="Lọc theo loại">
              <option value="all">Mọi loại</option>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sắp xếp">
              <option value="created">Mới ghi</option>
              <option value="updated">Mới sửa</option>
              <option value="score">ICE cao nhất</option>
              <option value="title">Tên A→Z</option>
            </select>
          </div>
          {allTags.length > 0 && (
            <div className="tag-strip" role="group" aria-label="Lọc theo tag">
              {allTags.slice(0, 24).map(([t, n]) => (
                <button key={t} className={'tag-filter' + (tag === t ? ' on' : '')} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                  #{t} <span className="num">{n}</span>
                </button>
              ))}
            </div>
          )}

          {ideas.length === 0 ? (
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
          ) : list.length === 0 ? (
            <p className="empty-line">
              Không có ý tưởng nào khớp bộ lọc.{' '}
              {filtered && (
                <button
                  className="text-btn"
                  onClick={() => {
                    setStage('all')
                    setKind('all')
                    setTag(null)
                    onQuery('')
                  }}
                >
                  Bỏ lọc
                </button>
              )}
            </p>
          ) : (
            <div className="rows">
              {list.map((i) => (
                <IdeaRow key={i.id} idea={i} attCount={attCounts?.get(i.id)} />
              ))}
            </div>
          )}
        </section>

        {side && ideas.length > 0 && (
          <aside className="side">
            <section className="panel" aria-labelledby="due-h">
              <div className="panel-head">
                <h2 id="due-h">Chờ ôn lại</h2>
                {dueCount > 0 && (
                  <a href="#/review" className="head-link">
                    Ôn {dueCount}
                  </a>
                )}
              </div>
              {side.due.length ? (
                <ul className="mini-list">
                  {side.due.map((i) => (
                    <li key={i.id}>
                      <a href={'#/idea/' + i.id}>{i.title}</a>
                      <span className="muted num">{Math.floor((Date.now() - (i.reviewedAt ?? i.createdAt)) / DAY)} ngày</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="panel-note">Không có ý tưởng nào quá {reviewAfterDays} ngày chưa xem lại.</p>
              )}
            </section>
            <section className="panel" aria-labelledby="week-h">
              <div className="panel-head">
                <h2 id="week-h">7 ngày qua</h2>
                <span className="muted num">{side.week.reduce((a, d) => a + d.n, 0)} ý tưởng</span>
              </div>
              <WeekStrip days={side.week} />
            </section>
            <section className="panel" aria-labelledby="top-h">
              <div className="panel-head">
                <h2 id="top-h">Nên làm trước</h2>
              </div>
              {side.top.length ? (
                <ol className="mini-list ranked">
                  {side.top.map((i) => (
                    <li key={i.id}>
                      <a href={'#/idea/' + i.id}>{i.title}</a>
                      <span className="num ice-figure">{iceScore(i)!.toFixed(1)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="panel-note">Chấm điểm ICE trong từng ý tưởng, cái nào đáng làm nhất sẽ hiện ở đây.</p>
              )}
            </section>
          </aside>
        )}
      </div>
    </div>
  )
}

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** Số ý tưởng ghi mỗi ngày trong tuần, cột cao theo số lượng, hôm nay ở cuối. */
function WeekStrip({ days }: { days: { start: number; n: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.n))
  return (
    <div className="week" role="img" aria-label={days.map((d) => `${WEEKDAY[new Date(d.start).getDay()]}: ${d.n}`).join(', ')}>
      {days.map((d, k) => (
        <div key={d.start} className={'week-day' + (k === days.length - 1 ? ' today' : '')}>
          <span className="week-n num">{d.n || ''}</span>
          <span className="week-bar">
            <span style={{ height: d.n ? `${(d.n / max) * 100}%` : 0 }} />
          </span>
          <span className="week-label">{k === days.length - 1 ? 'Nay' : WEEKDAY[new Date(d.start).getDay()]}</span>
        </div>
      ))}
    </div>
  )
}

function stageTitle(f: StageFilter) {
  if (f === 'active') return 'Ý tưởng đang sống'
  if (f === 'all') return 'Tất cả ý tưởng'
  if (f === 'shelved') return 'Đã gác lại'
  return STATUSES.find((s) => s.value === f)!.label
}

/** Dải tiến trình: số ý tưởng ở mỗi giai đoạn, đồng thời là bộ lọc chính. */
function Pipeline({ ideas, stage, onStage }: { ideas: Idea[]; stage: StageFilter; onStage: (s: StageFilter) => void }) {
  const count = (f: StageFilter) => ideas.filter((i) => inStage(i, f)).length
  const cells: { f: StageFilter; label: string }[] = [
    { f: 'active', label: 'Đang sống' },
    ...(['spark', 'exploring', 'validating', 'building', 'shipped'] as const).map((v) => ({ f: v, label: STATUSES.find((s) => s.value === v)!.label })),
    { f: 'shelved', label: 'Gác lại' },
    { f: 'all', label: 'Tất cả' },
  ]
  const total = ideas.length || 1
  const segs = STATUSES.map((s) => ({ ...s, n: ideas.filter((i) => i.status === s.value).length })).filter((s) => s.n)
  return (
    <section className="pipeline" aria-label="Ý tưởng theo giai đoạn">
      <div className="stages" role="group" aria-label="Lọc theo giai đoạn">
        {cells.map((c) => (
          <button key={c.f} className={'stage' + (stage === c.f ? ' on' : '') + (c.f === 'active' || c.f === 'all' ? ' sum' : '')} aria-pressed={stage === c.f} onClick={() => onStage(c.f)}>
            <span className="stage-label">{c.label}</span>
            <span className="stage-n num">{count(c.f)}</span>
          </button>
        ))}
      </div>
      <div className="stage-bar" aria-hidden="true">
        {segs.map((s) => (
          <span key={s.value} className={'stage-seg tone-' + s.tone} style={{ flexGrow: s.n / total }} title={`${s.label}: ${s.n}`} />
        ))}
      </div>
    </section>
  )
}
