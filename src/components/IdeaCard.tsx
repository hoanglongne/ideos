import type { Idea } from '../types'
import { STATUSES } from '../types'
import { go } from '../lib/router'
import { iceScore, kindMeta, timeAgo } from '../lib/util'

export function StatusBadge({ status }: { status: Idea['status'] }) {
  const s = STATUSES.find((x) => x.value === status)!
  return (
    <span className="status" style={{ '--c': s.color } as React.CSSProperties}>
      {s.label}
    </span>
  )
}

export function IdeaCard({ idea, attCount }: { idea: Idea; attCount?: number }) {
  const k = kindMeta(idea.kind)
  const ice = iceScore(idea)
  const doneTasks = idea.tasks.filter((t) => t.done).length
  return (
    <button className={'card' + (idea.pinned ? ' pinned' : '')} onClick={() => go('/idea/' + idea.id)}>
      <div className="card-top">
        <span className="kind" title={k.label}>
          {k.emoji}
        </span>
        <span className="card-title">{idea.title || 'Không tiêu đề'}</span>
        {idea.pinned && <span title="Đã ghim">📌</span>}
      </div>
      {idea.body && <p className="card-body">{idea.body}</p>}
      <div className="card-meta">
        <StatusBadge status={idea.status} />
        {ice !== null && <span className="ice" title="Điểm ICE">⚡ {ice}</span>}
        {idea.tasks.length > 0 && (
          <span className="muted small">
            ☑ {doneTasks}/{idea.tasks.length}
          </span>
        )}
        {!!attCount && <span className="muted small">📎 {attCount}</span>}
        {idea.tags.slice(0, 3).map((t) => (
          <span key={t} className="tag small">
            #{t}
          </span>
        ))}
        <span className="muted small push">{timeAgo(idea.createdAt)}</span>
      </div>
    </button>
  )
}
