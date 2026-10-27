import { describe, expect, it } from 'vitest'
import { defaultInputs, newMoneyPlan, switchModel } from './models'
import { customersNeeded, simulate, summarize, unitModel } from './plan'
import { sensitivities, verdict } from './sensitivity'

const saas = () => ({ ...defaultInputs('saas', 'VND'), price: 200_000, churn_pct: 5, var_cost_pct: 10, fee_pct: 0, tax_pct: 0, fixed_cost: 4_000_000, cac: 400_000, marketing_budget: 4_000_000 })

describe('unitModel', () => {
  it('thuê bao: arpu = giá, lãi góp trừ phí/thuế/chi phí biến đổi', () => {
    const u = unitModel({ ...saas(), fee_pct: 2, tax_pct: 3 })
    expect(u.arpu).toBe(200_000)
    expect(u.churn).toBeCloseTo(0.05)
    expect(u.contribution).toBeCloseTo(200_000 * 0.85)
  })
  it('theo đơn: mua nhiều mà ít quay lại thì mua hết số đơn cả đời ngay tháng đầu', () => {
    const u = unitModel({ ...defaultInputs('ecommerce', 'VND'), price: 100, orders_per_month: 4, repeat_pct: 50, var_cost_pct: 0, fee_pct: 0, tax_pct: 0 })
    expect(u.churn).toBe(1)
    expect(u.arpu).toBeCloseTo(100 * 2) // L = 1/(1-0.5) = 2 đơn
  })
  it('sàn chỉ tính phần phí giữ lại', () => {
    const u = unitModel({ ...defaultInputs('marketplace', 'VND'), price: 1000, orders_per_month: 1, repeat_pct: 0, take_rate_pct: 10 })
    expect(u.arpu).toBeCloseTo(100)
  })
})

describe('customersNeeded', () => {
  it('đủ khách để lãi góp bù chi phí cố định, tính cả marketing bù khách rời đi', () => {
    // lãi góp 180k, rời đi 5% × CAC 400k = 20k → mỗi khách còn 160k; cố định 4tr → 25 khách
    expect(customersNeeded(saas(), 0).value).toBe(25)
  })
  it('càng đông càng lỗ thì báo lý do thay vì trả số vô nghĩa', () => {
    const m = customersNeeded({ ...saas(), cac: 10_000_000 }, 0)
    expect(m.value).toBeNull()
    expect(m.reason).toMatch(/càng đông càng lỗ/)
  })
  it('giá thấp hơn chi phí thì báo lỗ từng khách', () => {
    expect(customersNeeded({ ...saas(), var_cost_pct: 120 }, 0).reason).toMatch(/lỗ/)
  })
})

describe('simulate / summarize', () => {
  it('khách tích luỹ theo churn và tiền mặt cộng dồn lãi', () => {
    const i = { ...saas(), start_cash: 10_000_000, horizon: 3 }
    const rows = simulate(i)
    expect(rows[0].newCustomers).toBeCloseTo(10)
    expect(rows[1].customers).toBeCloseTo(10 * 0.95 + 10)
    expect(rows[2].cash).toBeCloseTo(10_000_000 + rows.reduce((s, r) => s + r.profit, 0))
  })
  it('tìm tháng hoà vốn và vốn cần chuẩn bị', () => {
    const i = { ...saas(), horizon: 36 }
    const s = summarize(i)
    expect(s.breakEvenMonth).not.toBeNull()
    expect(s.fundingNeeded).toBeGreaterThan(0)
    expect(s.minCash).toBeLessThan(0)
    expect(s.cashOutMonth).toBe(1)
  })
  it('LTV/CAC và hoàn vốn', () => {
    const s = summarize(saas())
    expect(s.ltv.value).toBeCloseTo((200_000 * 0.9) / 0.05)
    expect(s.ltvCac.value).toBeCloseTo(s.ltv.value! / 400_000)
    expect(s.payback.value).toBeCloseTo(400_000 / 180_000)
  })
  it('không có khách rời đi thì LTV không giới hạn, có lý do', () => {
    expect(summarize({ ...saas(), churn_pct: 0 }).ltv.reason).toMatch(/không giới hạn/)
  })
})

describe('switchModel', () => {
  it('giữ ô đã tự nhập, thay ô còn là số trung bình', () => {
    const p = newMoneyPlan('saas', 'VND')
    p.inputs.price = 999
    p.assumed = p.assumed.filter((k) => k !== 'price')
    const q = switchModel(p, 'ecommerce', 'VND')
    expect(q.inputs.price).toBe(999)
    expect(q.inputs.var_cost_pct).toBe(50)
    expect(q.inputs.model).toBe('ecommerce')
  })
  it('đổi tiền tệ thì ô tiền quay về số trung bình, tỉ lệ % giữ', () => {
    const p = newMoneyPlan('saas', 'VND')
    p.inputs.price = 999
    p.inputs.churn_pct = 7
    p.assumed = p.assumed.filter((k) => k !== 'price' && k !== 'churn_pct')
    const q = switchModel(p, 'saas', 'USD')
    expect(q.inputs.price).toBe(19)
    expect(q.inputs.churn_pct).toBe(7)
    expect(q.assumed).toContain('price')
  })
})

describe('sensitivities', () => {
  const i = { ...saas(), horizon: 36, start_cash: 60_000_000 }
  it('xếp con số làm tụt tiền nhiều nhất lên đầu', () => {
    const rows = sensitivities(i)
    expect(rows.length).toBeGreaterThan(3)
    for (let k = 1; k < rows.length; k++) expect(rows[k - 1].loss).toBeGreaterThanOrEqual(rows[k].loss)
    expect(rows.every((r) => r.key !== 'repeat_pct' && r.key !== 'take_rate_pct')).toBe(true) // không áp dụng cho thuê bao
  })
  it('đánh dấu rủi ro cao khi làm xấu đi 30% là đổ kế hoạch', () => {
    const tight = { ...saas(), horizon: 12, marketing_budget: 2_000_000, start_cash: 100_000_000 }
    const s = summarize(tight)
    expect(s.breakEvenMonth).not.toBeNull()
    const rows = sensitivities(tight)
    const flipped = rows.filter((r) => r.flips)
    expect(flipped.length).toBeGreaterThan(0)
    expect(flipped.every((r) => r.risk === 3)).toBe(true)
  })
  it('con số chưa tự nhập được nâng một bậc rủi ro', () => {
    const a = sensitivities(i).find((r) => r.key === 'var_cost_pct')!
    const b = sensitivities(i, ['var_cost_pct']).find((r) => r.key === 'var_cost_pct')!
    expect(b.risk).toBe(a.risk === 3 ? 3 : a.risk + 1)
    expect(b.assumed).toBe(true)
  })
  it('bỏ qua con số bằng 0 (không có gì để làm xấu)', () => {
    expect(sensitivities({ ...i, churn_pct: 0 }).some((r) => r.key === 'churn_pct')).toBe(false)
  })
  it('mỗi dòng có câu giả định và cách thử', () => {
    for (const r of sensitivities(i)) {
      expect(r.claim.length).toBeGreaterThan(10)
      expect(r.test.length).toBeGreaterThan(10)
    }
  })
})

describe('verdict', () => {
  it('nói thẳng khi mỗi khách đang lỗ', () => {
    const i = { ...saas(), var_cost_pct: 120 }
    expect(verdict(i, summarize(i)).tone).toBe('negative')
  })
  it('nói thẳng khi chưa hoà vốn trong kỳ', () => {
    const i = { ...saas(), horizon: 3 }
    const v = verdict(i, summarize(i))
    expect(v.tone).toBe('negative')
    expect(v.text).toMatch(/chưa hoà vốn/)
  })
  it('có hoà vốn thì nêu tháng và vốn cần', () => {
    const i = { ...saas(), horizon: 36, cac: 100_000, marketing_budget: 2_000_000 }
    const v = verdict(i, summarize(i))
    expect(v.text).toMatch(/Hoà vốn vào tháng \d+/)
  })
})
