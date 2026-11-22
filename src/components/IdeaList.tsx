import { useLiveQuery } from 'dexie-react-hooks'
import { Search } from 'lucide-react'
import { useMemo, useState, type RefObject } from 'react'
import { db } from '../db'
import { iceScore, matchesQuery } from '../lib/util'
import { KINDS, type Idea, type IdeaKind, type IdeaStatus } from '../types'
import { IdeaRow } from './IdeaRow'

type Sort = 'created' | 'updated' | 'score' | 'title'
type Group = 'running' | 'shelved' | 'shipped' | 'all'

const SORTS: Record<Sort, (a: Idea, b: Idea) => number> = {
  created: (a, b) => b.createdAt - a.createdAt,
  updated: (a, b) => b.updatedAt - a.updatedAt,
  score: (a, b) => (iceScore(b) ?? -1) - (iceScore(a) ?? -1) || b.createdAt - a.createdAt,
  title: (a, b) => a.title.localeCompare(b.title, 'vi'),
}

const GROUPS: { value: Group; label: string; statuses: IdeaStatus[] | null }[] = [
  { value: 'running', label: 'Đang chạy', statuses: ['spark', 'exploring', 'validating', 'building'] },
  { value: 'shipped', label: 'Đã ra mắt', statuses: ['shipped'] },
  { value: 'shelved', label: 'Để sau', statuses: ['parked', 'dropped'] },
  { value: 'all', label: 'Tất cả', statuses: null },
]

const loadPref = <T,>(key: string, def: T): T => {
  try {
    const v = sessionStorage.getItem('ideos.' + key)
    return v ? (JSON.parse(v) as T) : def
  } catch {
    return def
  }
}
function usePref<T>(key: string, def: T) {
  const [v, setV] = useState<T>(() => loadPref(key, def))
  return [
    v,
    (nv: T) => {
      setV(nv)
      try {
        sessionStorage.setItem('ideos.' + key, JSON.stringify(nv))
      } catch {
        /* bỏ qua */
      }
    },
  ] as const
}

/** Danh sách đầy đủ: tìm, chia theo nhóm, bộ lọc phụ (loại, nhãn, sắp xếp) nằm sau một nút để khỏi rối. */
export function IdeaList({ query, onQuery, searchRef }: { query: string; onQuery: (q: string) => void; searchRef: RefObject<HTMLInputElement | null> }) {
  const ideas = useLiveQuery(() => db.ideas.toArray(), [])
  const attCounts = useLiveQuery(async () => {
    const m = new Map<string, number>()
    await db.attachments.each((a) => m.set(a.ideaId, (m.get(a.ideaId) ?? 0) + 1))
    return m
  }, [])
  const [group, setGroup] = usePref<Group>('group', 'running')
  const [kind, setKind] = usePref<IdeaKind | 'all'>('kind', 'all')
  const [tag, setTag] = usePref<string | null>('tag', null)
  const [sort, setSort] = usePref<Sort>('sort', 'created')

  const allTags = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of ideas ?? []) for (const t of i.tags) m.set(t, (m.get(t) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [ideas])

  const inGroup = (i: Idea, g: Group) => {
    const st = GROUPS.find((x) => x.value === g)!.statuses
    return !st || st.includes(i.status)
  }
  const list = useMemo(() => {
    if (!ideas) return []
    return ideas
      .filter((i) => inGroup(i, group) && (kind === 'all' || i.kind === kind) && (!tag || i.tags.includes(tag)) && matchesQuery(i, query))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || SORTS[sort](a, b))
  }, [ideas, group, kind, tag, sort, query])

  if (!ideas) return null
  const narrowed = kind !== 'all' || !!tag
  const clear = () => {
    setGroup('all')
    setKind('all')
    setTag(null)
    onQuery('')
  }

  return (
    <div className="ideas">
      <header className="today-head">
        <h1 className="today-title">Ý tưởng</h1>
      </header>

      <label className="search">
        <Search size={16} strokeWidth={1.8} aria-hidden />
        <input ref={searchRef} type="search" placeholder="Tìm theo chữ hoặc #nhãn" value={query} onChange={(e) => onQuery(e.target.value)} aria-label="Tìm ý tưởng" />
      </label>

      <div className="seg group-seg" role="radiogroup" aria-label="Nhóm ý tưởng">
        {GROUPS.map((g) => (
          <button key={g.value} role="radio" aria-checked={group === g.value} className={group === g.value ? 'on' : ''} onClick={() => setGroup(g.value)}>
            {g.label} <span className="num">{ideas.filter((i) => inGroup(i, g.value)).length}</span>
          </button>
        ))}
      </div>

      <details className="filters" open={narrowed}>
        <summary>Lọc và sắp xếp{narrowed ? ' (đang lọc)' : ''}</summary>
        <div className="filters-body">
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
          {allTags.length > 0 && (
            <div className="tag-strip" role="group" aria-label="Lọc theo nhãn">
              {allTags.slice(0, 24).map(([t, n]) => (
                <button key={t} className={'tag-filter' + (tag === t ? ' on' : '')} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                  #{t} <span className="num">{n}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </details>

      {list.length === 0 ? (
        <p className="empty-line">
          {ideas.length === 0 ? 'Chưa có ý tưởng nào. Bấm Ghi để bắt đầu.' : 'Không có ý tưởng nào khớp.'}{' '}
          {ideas.length > 0 && (
            <button className="text-btn" onClick={clear}>
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
    </div>
  )
}
