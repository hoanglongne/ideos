import { Pin } from 'lucide-react'
import type { Idea } from '../types'
import { STATUSES } from '../types'
import { maturity } from '../lib/insight'
import { iceScore, kindMeta, timeAgo } from '../lib/util'

export function StatusPill({ status }: { status: Idea['status'] }) {
  const s = STATUSES.find((x) => x.value === status)!
  return <span className={'pill tone-' + s.tone}>{s.label}</span>
}

export function IdeaRow({ idea, attCount }: { idea: Idea; attCount?: number }) {
  const ice = iceScore(idea)
  const done = idea.tasks.filter((t) => t.done).length
  const sub = [
    kindMeta(idea.kind).label,
    idea.tags.length ? idea.tags.slice(0, 3).map((t) => '#' + t).join(' ') : null,
    idea.tasks.length ? `${done}/${idea.tasks.length} việc` : null,
    attCount ? `${attCount} đính kèm` : null,
    maturity(idea),
  ].filter(Boolean)
  return (
    <a className="row" href={'#/idea/' + idea.id}>
      <span className="row-title">
        {idea.pinned && <Pin size={13} strokeWidth={1.8} className="row-pin" aria-label="Đã ghim" />}
        {idea.title || 'Không tiêu đề'}
      </span>
      <span className="row-sub">{sub.join(' · ')}</span>
      <span className="row-status">
        <StatusPill status={idea.status} />
      </span>
      <span className={'row-ice num' + (ice === null ? ' none' : '')} title="Điểm ICE">
        {ice === null ? '—' : ice.toFixed(1)}
      </span>
      <span className="row-date">{timeAgo(idea.createdAt)}</span>
    </a>
  )
}
