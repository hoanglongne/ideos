import { describe, expect, it } from 'vitest'
import { newIdea } from '../db'
import type { Idea } from '../types'
import { NEXT_STEP, SESSION_SIZE, nextQuestion } from './coach'

const run = (idea: Idea, answer: (i: Idea, id: string) => Idea = (i) => i) => {
  const asked: string[] = []
  let cur = idea
  for (let q = nextQuestion(cur, asked); q; q = nextQuestion(cur, asked)) {
    asked.push(q.id)
    cur = answer(cur, q.id)
  }
  return asked
}

describe('chọn câu hỏi mài ý tưởng', () => {
  it('ý tưởng mới nảy ra: hỏi vấn đề, người dùng, cách xoay xở trước; tối đa 5 câu rồi chốt việc 48 giờ', () => {
    const asked = run(newIdea({ status: 'spark' }))
    expect(asked.slice(0, 3)).toEqual(['problem', 'audience', 'competitors'])
    expect(asked.length).toBe(SESSION_SIZE + 1)
    expect(asked.at(-1)).toBe(NEXT_STEP.id)
  })

  it('không hỏi lại thứ đã có câu trả lời', () => {
    const i = newIdea({ status: 'spark' })
    i.canvas.problem = 'đã có'
    expect(run(i)).not.toContain('problem')
  })

  it('đang kiểm chứng: vừa ghi giả định xong thì hỏi ngay giả định rủi ro nhất', () => {
    const i = newIdea({ status: 'validating' })
    i.canvas = { problem: 'x', audience: 'x', competitors: 'x', solution: '', monetization: '', unfair: '' }
    const asked = run(i, (cur, id) =>
      id === 'assumptions'
        ? { ...cur, assumptions: [{ id: 'a', text: 'a', risk: 2, test: '', status: 'untested', createdAt: 0 }, { id: 'b', text: 'b', risk: 2, test: '', status: 'untested', createdAt: 0 }] }
        : cur,
    )
    expect(asked.indexOf('riskiest')).toBe(asked.indexOf('assumptions') + 1)
  })

  it('ý tưởng đã đủ mọi thứ vẫn có một câu: việc 48 giờ', () => {
    const i = newIdea({ status: 'shipped', scores: { impact: 5, confidence: 5, ease: 5 } })
    expect(run(i)).toEqual([NEXT_STEP.id])
  })
})
