import type { Idea } from '../types'
import { iceScore } from './util'

export interface ConfidenceHint {
  value: number
  reason: string
}

/**
 * Gợi ý điểm Confidence (1–10) từ những gì đã kiểm chứng, thay vì cảm giác:
 * giả định đúng kéo lên, giả định sai kéo xuống (nặng nhẹ theo rủi ro), bằng chứng cộng trừ nhẹ hơn.
 * Còn giả định rủi ro cao chưa thử thì không cho vượt 6: chưa biết điều quan trọng nhất có đúng không.
 */
export function suggestConfidence(idea: Pick<Idea, 'assumptions' | 'evidence'>): ConfidenceHint | null {
  const { assumptions, evidence } = idea
  if (!assumptions.length && !evidence.length) return null
  const holds = assumptions.filter((a) => a.status === 'holds')
  const broken = assumptions.filter((a) => a.status === 'broken')
  const pro = evidence.filter((e) => e.signal === 'for').length
  const con = evidence.filter((e) => e.signal === 'against').length
  const W_HOLD = { 1: 1, 2: 1.5, 3: 2 } as const
  const W_BREAK = { 1: 1, 2: 2, 3: 3 } as const
  let v = 3
  for (const a of holds) v += W_HOLD[a.risk]
  for (const a of broken) v -= W_BREAK[a.risk]
  v += Math.min(3, pro * 0.5) - con * 0.75
  const riskyOpen = assumptions.some((a) => a.risk === 3 && (a.status === 'untested' || a.status === 'testing'))
  if (riskyOpen) v = Math.min(v, 6)
  const value = Math.max(1, Math.min(10, Math.round(v)))

  const parts: string[] = []
  if (holds.length) parts.push(`${holds.length} giả định đúng`)
  if (broken.length) parts.push(`${broken.length} sai`)
  if (pro) parts.push(`${pro} bằng chứng ủng hộ`)
  if (con) parts.push(`${con} phản bác`)
  if (riskyOpen) parts.push('còn giả định rủi ro cao chưa thử')
  return { value, reason: parts.join(', ') || 'chưa có giả định nào được thử' }
}

export interface NextAction {
  ideaId: string
  ideaTitle: string
  text: string
  kind: 'test' | 'task'
  ice: number | null
}

const ACTIVE = new Set(['spark', 'exploring', 'validating', 'building'])

/**
 * Việc nên làm tiếp trên mọi ý tưởng đang sống: trước hết là thử các giả định rủi ro cao,
 * sau đó là các bước tiếp theo chưa xong; ý tưởng ICE cao hơn đứng trước.
 */
export function nextActions(ideas: Idea[], limit = 5): NextAction[] {
  const out: (NextAction & { rank: number })[] = []
  for (const i of ideas) {
    if (!ACTIVE.has(i.status)) continue
    const ice = iceScore(i)
    const base = ice ?? 2
    for (const a of i.assumptions) {
      if (a.status !== 'untested' && a.status !== 'testing') continue
      out.push({ ideaId: i.id, ideaTitle: i.title, kind: 'test', ice, text: a.test.trim() ? a.test : `Thử: ${a.text}`, rank: 20 + a.risk * 5 + base })
    }
    for (const t of i.tasks) if (!t.done) out.push({ ideaId: i.id, ideaTitle: i.title, kind: 'task', ice, text: t.text, rank: 10 + base })
  }
  return out.sort((a, b) => b.rank - a.rank).slice(0, limit)
}

/** Tóm tắt độ "chín" của ý tưởng cho dòng phụ trong danh sách. */
export function maturity(idea: Idea): string | null {
  const tested = idea.assumptions.filter((a) => a.status === 'holds' || a.status === 'broken').length
  const parts: string[] = []
  if (idea.assumptions.length) parts.push(`${tested}/${idea.assumptions.length} giả định đã thử`)
  if (idea.evidence.length) parts.push(`${idea.evidence.length} bằng chứng`)
  if (idea.journal.length) parts.push(`${idea.journal.length} ghi chú`)
  return parts.length ? parts.join(' · ') : null
}
