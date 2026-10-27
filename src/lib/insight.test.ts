import { describe, expect, it } from 'vitest'
import type { Assumption, Evidence } from '../types'
import { suggestConfidence } from './insight'
import { newMoneyPlan } from './money/models'

const a = (risk: Assumption['risk'], status: Assumption['status']): Assumption => ({ id: Math.random() + '', text: 'x', risk, test: '', status, createdAt: 0 })
const e = (signal: Evidence['signal']): Evidence => ({ id: Math.random() + '', at: 0, text: 'x', source: '', signal })

describe('gợi ý độ tự tin', () => {
  it('không có gì để dựa vào thì không gợi ý', () => {
    expect(suggestConfidence({ assumptions: [], evidence: [] })).toBeNull()
  })
  it('giả định rủi ro cao đã đúng + bằng chứng ủng hộ thì cao', () => {
    expect(suggestConfidence({ assumptions: [a(3, 'holds'), a(2, 'holds')], evidence: [e('for'), e('for'), e('for')] })!.value).toBe(8)
  })
  it('còn giả định rủi ro cao chưa thử thì không vượt 6, dù nhiều bằng chứng', () => {
    const h = suggestConfidence({ assumptions: [a(3, 'untested'), a(2, 'holds'), a(2, 'holds')], evidence: [e('for'), e('for'), e('for'), e('for')] })!
    expect(h.value).toBe(6)
    expect(h.reason).toContain('rủi ro cao chưa thử')
  })
  it('giả định rủi ro cao bị sai kéo xuống thấp, không dưới 1', () => {
    expect(suggestConfidence({ assumptions: [a(3, 'broken'), a(3, 'broken')], evidence: [e('against')] })!.value).toBe(1)
  })
  it('bài toán tiền chưa hoà vốn thì không vượt 5, dù giả định đều đúng', () => {
    const money = newMoneyPlan('saas', 'VND')
    money.inputs.horizon = 3
    const h = suggestConfidence({ assumptions: [a(3, 'holds'), a(3, 'holds')], evidence: [e('for'), e('for')], money })!
    expect(h.value).toBe(5)
    expect(h.reason).toContain('bài toán tiền chưa hoà vốn')
  })
  it('chỉ có bài toán tiền cũng đủ để gợi ý', () => {
    expect(suggestConfidence({ assumptions: [], evidence: [], money: newMoneyPlan('saas', 'VND') })).not.toBeNull()
  })
})
