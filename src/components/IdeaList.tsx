import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../db'
import { iceScore, matchesQuery } from '../lib/util'
import { KINDS, STATUSES, type Idea, type IdeaKind, type IdeaStatus } from '../types'
import { IdeaCard } from './IdeaCard'

type Sort = 'created' | 'updated' | 'score' | 'title'

const SORTS: Record<Sort, (a: Idea, b: Idea) => number> = {
  created: (a, b) => b.createdAt - a.createdAt,
  updated: (a, b) => b.updatedAt - a.updatedAt,
  score: (a, b) => (iceScore(b) ?? -1) - (iceScore(a) ?? -1) || b.createdAt - a.createdAt,
  title: (a, b) => a.title.localeCompare(b.title, 'vi'),
}

const ACTIVE: IdeaStatus[] = ['spark', 'exploring', 'validating', 'building']

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

export function IdeaList({ query, onNew }: { query: string; onNew: () => void }) {
  const ideas = useLiveQuery(() => db.ideas.toArray(), [])
  const attCounts = useLiveQuery(async () => {
    const m = new Map<string, number>()
    await db.attachments.each((a) => m.set(a.ideaId, (m.get(a.ideaId) ?? 0) + 1))
    return m
  }, [])
  const [status, setStatus] = usePref<IdeaStatus | 'active' | 'all'>('status', 'active')
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
    const filtered = ideas.filter(
      (i) =>
        (status === 'all' || (status === 'active' ? ACTIVE.includes(i.status) : i.status === status)) &&
        (kind === 'all' || i.kind === kind) &&
        (!tag || i.tags.includes(tag)) &&
        matchesQuery(i, query),
    )
    const cmp = SORTS[sort]
    return filtered.sort((a, b) => Number(b.pinned) - Number(a.pinned) || cmp(a, b))
  }, [ideas, status, kind, tag, sort, query])

  if (!ideas) return null

  if (ideas.length === 0)
    return (
      <div className="empty">
        <div className="empty-emoji">💡</div>
        <h2>Chưa có ý tưởng nào</h2>
        <p className="muted">Lần tới chợt nghĩ ra gì đó khi đang đi đường, bấm nút + là ghi được ngay — kể cả khi không có mạng.</p>
        <button className="btn primary big" onClick={onNew}>
          Ghi ý tưởng đầu tiên
        </button>
        <div className="tips">
          <p>
            <b>Mẹo:</b> dòng đầu là tiêu đề · <code>#tag</code> để gắn nhãn · <code>@app</code> <code>@web</code> <code>@startup</code> để chọn loại
          </p>
          <p>
            Phím tắt: <kbd>N</kbd> ghi mới · <kbd>/</kbd> tìm kiếm · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> lưu
          </p>
        </div>
      </div>
    )

  return (
    <div className="list-view">
      <div className="filters">
        <div className="chips scroll">
          {(
            [
              ['active', 'Đang sống'],
              ['all', 'Tất cả'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} className={'chip' + (status === v ? ' on' : '')} onClick={() => setStatus(v)}>
              {l}
            </button>
          ))}
          {STATUSES.map((s) => (
            <button key={s.value} className={'chip' + (status === s.value ? ' on' : '')} onClick={() => setStatus(s.value)}>
              <span className="dot" style={{ background: s.color }} /> {s.label}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <select value={kind} onChange={(e) => setKind(e.target.value as IdeaKind | 'all')} aria-label="Lọc theo loại">
            <option value="all">Mọi loại</option>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.emoji} {k.label}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sắp xếp">
            <option value="created">Mới nhất</option>
            <option value="updated">Mới sửa</option>
            <option value="score">Điểm ICE cao</option>
            <option value="title">Tên A→Z</option>
          </select>
        </div>
        {allTags.length > 0 && (
          <div className="chips scroll">
            {allTags.slice(0, 30).map(([t, n]) => (
              <button key={t} className={'chip tagchip' + (tag === t ? ' on' : '')} onClick={() => setTag(tag === t ? null : t)}>
                #{t} <span className="muted">{n}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="muted small count">{list.length} ý tưởng</p>
      <div className="cards">
        {list.map((i) => (
          <IdeaCard key={i.id} idea={i} attCount={attCounts?.get(i.id)} />
        ))}
        {list.length === 0 && <p className="muted center pad">Không có ý tưởng nào khớp bộ lọc.</p>}
      </div>
    </div>
  )
}
