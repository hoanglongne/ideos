import { describe, expect, it } from 'vitest'
import { newIdea } from '../db'
import type { Assumption, Idea } from '../types'
import { newMoneyPlan } from './money/models'
import { nextStep, stepLabel, todayPlan } from './journey'

const as = (id: string, over: Partial<Assumption> = {}): Assumption => ({ id, text: 'giả định ' + id, risk: 2, test: '', status: 'untested', createdAt: 1, ...over })
const idea = (over: Partial<Idea> = {}): Idea => newIdea({ title: 'x', ...over })
const filled = { problem: 'p', audience: 'a', solution: '', monetization: '', competitors: '', unfair: '' }

describe('nextStep', () => {
  it('ý tưởng mới tinh: mài trước', () => {
    expect(nextStep(idea()).kind).toBe('coach')
    expect(nextStep(idea({ status: 'exploring' })).kind).toBe('coach')
  })
  it('đã rõ vấn đề và người dùng nhưng chưa có giả định: tìm giả định', () => {
    const s = nextStep(idea({ canvas: filled }))
    expect(s.kind).toBe('coach')
    expect(s.title).toMatch(/điều phải đúng/)
  })
  it('đã có giả định ở giai đoạn đầu: gợi ý chuyển sang kiểm chứng', () => {
    const s = nextStep(idea({ canvas: filled, assumptions: [as('a')] }))
    expect(s.kind).toBe('advance')
    expect(s.advanceTo).toBe('validating')
  })
  it('đang kiểm chứng: thử giả định rủi ro cao nhất chưa thử', () => {
    const s = nextStep(idea({ status: 'validating', canvas: filled, assumptions: [as('lo', { risk: 1 }), as('hi', { risk: 3, test: 'hỏi 5 người' }), as('done', { risk: 3, status: 'holds' })] }))
    expect(s.kind).toBe('test')
    expect(s.assumptionId).toBe('hi')
    expect(s.why).toBe('hỏi 5 người')
    expect(s.section).toBe('assumptions')
  })
  it('giả định chưa có cách thử thì nhắc nghĩ cách rẻ nhất', () => {
    const s = nextStep(idea({ status: 'validating', canvas: filled, assumptions: [as('a')] }))
    expect(s.why).toMatch(/rẻ nhất/)
  })
  it('đã thử hết nhưng chưa tính tiền: tính tiền; có tiền rồi: quyết định', () => {
    const base = { status: 'validating' as const, canvas: filled, assumptions: [as('a', { status: 'holds' })] }
    expect(nextStep(idea(base)).kind).toBe('money')
    expect(nextStep(idea({ ...base, money: newMoneyPlan('saas', 'VND') })).kind).toBe('decide')
  })
  it('đang làm: việc chưa xong đầu tiên; hết việc thì sẵn sàng ra mắt', () => {
    const t = (done: boolean, text: string) => ({ id: text, text, done })
    expect(nextStep(idea({ status: 'building', tasks: [t(true, 'a'), t(false, 'viết landing page')] })).title).toBe('viết landing page')
    const s = nextStep(idea({ status: 'building', tasks: [t(true, 'a')] }))
    expect(s.kind).toBe('ship')
    expect(s.advanceTo).toBe('shipped')
  })
  it('đã ra mắt: theo dõi số thật; để sau / đã bỏ: mở lại', () => {
    expect(nextStep(idea({ status: 'shipped' })).kind).toBe('track')
    expect(nextStep(idea({ status: 'shipped', money: newMoneyPlan('saas', 'VND') })).title).toMatch(/số thật/)
    expect(nextStep(idea({ status: 'parked' })).kind).toBe('resume')
    expect(nextStep(idea({ status: 'dropped' })).advanceTo).toBe('exploring')
  })
})

describe('todayPlan', () => {
  it('thử giả định rủi ro cao đứng trước mọi thứ, ý tưởng gác lại không vào kế hoạch', () => {
    const risky = idea({ title: 'rủi ro', status: 'validating', canvas: filled, assumptions: [as('x', { risk: 3 })] })
    const fresh = idea({ title: 'mới' })
    const parked = idea({ title: 'để sau', status: 'parked' })
    const plan = todayPlan([fresh, parked, risky], 5)
    expect(plan.map((p) => p.idea.title)).toEqual(['rủi ro', 'mới'])
  })
  it('giới hạn số mục', () => {
    expect(todayPlan([idea(), idea(), idea(), idea()], 2)).toHaveLength(2)
  })
})

describe('ý tưởng lâu không động tới', () => {
  const DAY = 86_400_000
  const now = 1_800_000_000_000
  it('quá 14 ngày thì hỏi lại trước mọi bước khác', () => {
    const stale = idea({ status: 'validating', canvas: filled, assumptions: [as('a')], updatedAt: now - 20 * DAY })
    const s = nextStep(stale, now)
    expect(s.kind).toBe('revisit')
    expect(s.why).toMatch(/20 ngày/)
  })
  it('mới xem lại (reviewedAt) thì không hỏi nữa', () => {
    const seen = idea({ status: 'exploring', updatedAt: now - 20 * DAY, reviewedAt: now - 1 * DAY })
    expect(nextStep(seen, now).kind).toBe('coach')
  })
  it('ý tưởng để sau hay đã ra mắt không bị hỏi lại', () => {
    expect(nextStep(idea({ status: 'parked', updatedAt: now - 90 * DAY }), now).kind).toBe('resume')
    expect(nextStep(idea({ status: 'shipped', updatedAt: now - 90 * DAY }), now).kind).toBe('track')
  })
  it('xếp sau việc thử giả định rủi ro cao, trước việc mài', () => {
    const risky = idea({ title: 'rủi ro', status: 'validating', canvas: filled, assumptions: [as('x', { risk: 3 })], updatedAt: now })
    const stale = idea({ title: 'cũ', status: 'exploring', updatedAt: now - 30 * DAY })
    const fresh = idea({ title: 'mới', updatedAt: now })
    expect(todayPlan([fresh, stale, risky], 5, now).map((p) => p.idea.title)).toEqual(['rủi ro', 'cũ', 'mới'])
  })
  it('nhãn một dòng', () => {
    expect(stepLabel({ kind: 'test', title: 'khách trả tiền', why: '', cta: '', section: null })).toBe('Thử: khách trả tiền')
    expect(stepLabel({ kind: 'revisit', title: 'x', why: '', cta: '', section: null })).toBe('Còn muốn làm không?')
  })
})
