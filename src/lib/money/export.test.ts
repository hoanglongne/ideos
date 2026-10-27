import { describe, expect, it } from 'vitest'
import { newIdea } from '../../db'
import { MODEL_IDS, newMoneyPlan } from './models'
import { observerFileName, observerProjectId, toObserverFile } from './export'

const idea = (model: Parameters<typeof newMoneyPlan>[0] = 'saas') => newIdea({ id: 'abc123-xyz', title: 'Ứng dụng tìm bạn chạy bộ', body: 'Ghép cặp theo pace.', money: newMoneyPlan(model, 'VND') })

describe('xuất sang Sổ Cái', () => {
  it('đúng vỏ file một dự án, kế hoạch gắn với dự án', () => {
    const f = toObserverFile(idea(), new Date('2026-10-27T10:00:00Z'))
    expect(f.app).toBe('so-cai-unit-economics')
    expect(f.kind).toBe('project')
    const [p] = f.data.projects
    const [pl] = f.data.plans
    expect(p.plan_id).toBe(pl.id)
    expect(p.model).toBe('saas')
    expect(p.currency).toBe('VND')
    expect(pl.start_month).toBe('2026-10')
    expect(p.name).toBe('Ứng dụng tìm bạn chạy bộ')
  })
  it('kế hoạch có đủ ô mà Sổ Cái cần, cả ô Ideos không hỏi', () => {
    for (const m of MODEL_IDS) {
      const inp = toObserverFile(idea(m)).data.plans[0].inputs as Record<string, unknown>
      for (const k of ['price', 'cac', 'fixed_cost', 'churn_pct', 'conversion_pct', 'budget_growth_pct', 'budget_cap', 'target_months', 'horizon', 'founder_salary'])
        expect(typeof inp[k], `${m}.${k}`).toBe('number')
    }
  })
  it('mã dự án ổn định theo ý tưởng để xuất lại thì cập nhật cùng dự án', () => {
    expect(observerProjectId(idea())).toBe('ung-dung-tim-ban-chay-bo-abc123')
    expect(observerFileName(idea())).toBe('so-cai-ung-dung-tim-ban-chay-bo-abc123.json')
    expect(observerProjectId({ id: 'q9', title: '' })).toBe('y-tuong-q9')
  })
  it('không có bài toán tiền thì không xuất', () => {
    expect(() => toObserverFile(newIdea({ title: 'x' }))).toThrow()
  })
})
