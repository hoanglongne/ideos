import { describe, expect, it } from 'vitest'
import { newIdea } from '../db'
import type { Idea } from '../types'
import { followupQuestion, isFollowup, MAX_FOLLOWUPS, NEXT_STEP, QUESTIONS, SESSION_SIZE, nextQuestion, shouldFollowUp } from './coach'

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


describe('hỏi tiếp bằng AI', () => {
  const text = QUESTIONS.find((q) => q.target.type === 'canvas')!
  const risk = QUESTIONS.find((q) => q.target.type === 'riskiest')!
  it('chỉ hỏi tiếp khi AI sẵn sàng, câu trả lời bằng chữ và đủ dài', () => {
    expect(shouldFollowUp(text, 'Chị Lan mua lều rồi để đó cả năm', 0, true)).toBe(true)
    expect(shouldFollowUp(text, 'Chị Lan mua lều rồi để đó cả năm', 0, false)).toBe(false)
    expect(shouldFollowUp(text, 'Ừ', 0, true)).toBe(false)
    expect(shouldFollowUp(text, null, 0, true)).toBe(false)
  })
  it('không hỏi tiếp trên câu chọn giả định, bằng chứng, điểm', () => {
    expect(shouldFollowUp(risk, 'một câu trả lời dài đủ mức', 0, true)).toBe(false)
  })
  it('không quá số lần mỗi phiên, và không hỏi tiếp trên chính câu hỏi tiếp', () => {
    expect(shouldFollowUp(text, 'Chị Lan mua lều rồi để đó cả năm', MAX_FOLLOWUPS, true)).toBe(false)
    const fu = followupQuestion(1, 'Chị Lan là ai?')
    expect(isFollowup(fu)).toBe(true)
    expect(shouldFollowUp(fu, 'Chị Lan là đồng nghiệp của tôi ở công ty', 0, true)).toBe(false)
  })
  it('câu hỏi tiếp có id riêng, không trùng câu của bộ câu hỏi', () => {
    expect(QUESTIONS.some((q) => q.id.startsWith('fu-'))).toBe(false)
  })
})
