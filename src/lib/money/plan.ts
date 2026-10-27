// Từ vài con số giả định → mỗi khách mang về bao nhiêu, cần bao nhiêu khách, cần bao nhiêu vốn, bao lâu hoà vốn.
// Hàm thuần. Mọi mô hình quy về: doanh thu mỗi khách mỗi tháng (arpu) + tỉ lệ khách rời đi mỗi tháng (churn).

import { MODELS, type PlanInputs } from './models'

export interface Metric {
  value: number | null
  /** Vì sao không tính được */
  reason?: string
}
const ok = (value: number): Metric => ({ value })
const na = (reason: string): Metric => ({ value: null, reason })

export interface UnitModel {
  arpu: number
  churn: number
  /** Lãi góp mỗi khách mỗi tháng = arpu × (1 − phí − thuế − chi phí biến đổi) */
  contribution: number
}

/**
 * Quy đổi về dạng thuê bao.
 * Theo đơn: khách mua f đơn/tháng khi còn hoạt động, mỗi lần có xác suất r mua tiếp
 * → số đơn cả đời L = 1/(1−r), churn = f(1−r). Nếu f(1−r) > 1 thì coi như mua hết L đơn ngay tháng đầu.
 */
export function unitModel(i: PlanInputs): UnitModel {
  const t = MODELS[i.model]
  const costShare = (i.fee_pct + i.tax_pct + i.var_cost_pct) / 100
  const out = (arpu: number, churn: number): UnitModel => ({ arpu, churn: Math.min(1, Math.max(0, churn)), contribution: arpu * (1 - costShare) })
  switch (t.planMode) {
    case 'subscription':
      return out(i.price, i.churn_pct / 100)
    case 'audience':
      return out((i.price / 1000) * i.orders_per_month, i.churn_pct / 100)
    case 'transaction':
    case 'marketplace': {
      const take = t.planMode === 'marketplace' ? i.take_rate_pct / 100 : 1
      const f = Math.max(0, i.orders_per_month)
      const r = Math.min(0.99, Math.max(0, i.repeat_pct / 100))
      const L = 1 / (1 - r)
      const raw = f * (1 - r)
      const [freq, churn] = raw > 1 ? [L, 1] : [f, raw]
      return out(i.price * freq * take, churn)
    }
  }
}

export interface PlanRow {
  i: number
  budget: number
  newCustomers: number
  customers: number
  revenue: number
  profit: number
  cash: number
}

/** Chi phí cố định thực tế (cộng lương muốn trả) và lãi mục tiêu */
export function goalParts(i: PlanInputs): { fixed: number; goalProfit: number } {
  return {
    fixed: i.fixed_cost + (i.goal_type === 'salary' ? i.goal_amount : 0),
    goalProfit: i.goal_type === 'profit' ? i.goal_amount : 0,
  }
}

export function simulate(i: PlanInputs, override?: Partial<PlanInputs>): PlanRow[] {
  const p = { ...i, ...override }
  const u = unitModel(p)
  const { fixed } = goalParts(p)
  const rows: PlanRow[] = []
  let customers = p.start_customers
  let cash = p.start_cash
  for (let m = 1; m <= p.horizon; m++) {
    const budget = p.marketing_budget
    const newCustomers = (p.cac > 0 ? budget / p.cac : 0) + p.organic_new
    customers = customers * (1 - u.churn) + newCustomers
    const revenue = customers * u.arpu
    const profit = customers * u.contribution - fixed - budget
    cash += profit
    rows.push({ i: m, budget, newCustomers, customers, revenue, profit, cash })
  }
  return rows
}

/** Số khách đang hoạt động cần để lãi = `profit`, tính cả marketing vừa đủ bù khách rời đi */
export function customersNeeded(i: PlanInputs, profit: number): Metric {
  const u = unitModel(i)
  const { fixed } = goalParts(i)
  const perCustomer = u.contribution - u.churn * i.cac
  if (u.contribution <= 0) return na('Mỗi khách đang lỗ ngay cả trước khi tính marketing: giá thấp hơn chi phí biến đổi cộng phí và thuế.')
  if (perCustomer <= 0) return na('Tiền kéo khách mới để bù khách rời đi lớn hơn lãi mỗi khách, nên càng đông càng lỗ. Cần giảm chi phí kéo khách, giảm khách rời đi hoặc tăng giá.')
  return ok(Math.ceil((fixed + profit) / perCustomer))
}

export interface PlanSummary {
  unit: UnitModel
  ltv: Metric
  ltvCac: Metric
  /** Số tháng để một khách trả lại tiền kéo khách */
  payback: Metric
  breakEvenCustomers: Metric
  goalCustomers: Metric
  breakEvenMonth: number | null
  goalMonth: number | null
  /** Tiền mặt thấp nhất trong thời gian mô phỏng, và vốn cần chuẩn bị để không âm */
  minCash: number
  fundingNeeded: number
  cashOutMonth: number | null
  endCash: number
}

export function summarize(i: PlanInputs, rows: PlanRow[] = simulate(i)): PlanSummary {
  const u = unitModel(i)
  const { goalProfit } = goalParts(i)
  const ltv: Metric = u.churn > 0 ? ok(u.contribution / u.churn) : na('Không có khách rời đi nên giá trị một khách không giới hạn. Hãy đặt tỉ lệ rời đi hoặc mua lại.')
  const ltvCac: Metric = ltv.value == null ? na(ltv.reason!) : i.cac <= 0 ? na('Chưa có chi phí kéo khách') : ok(ltv.value / i.cac)
  const payback: Metric = u.contribution <= 0 ? na('Mỗi khách không có lãi nên không hoàn vốn') : ok(i.cac / u.contribution)
  let minCash = i.start_cash
  for (const r of rows) minCash = Math.min(minCash, r.cash)
  return {
    unit: u,
    ltv,
    ltvCac,
    payback,
    breakEvenCustomers: customersNeeded(i, 0),
    goalCustomers: customersNeeded(i, goalProfit),
    breakEvenMonth: rows.find((r) => r.profit >= 0)?.i ?? null,
    goalMonth: rows.find((r) => r.profit >= goalProfit)?.i ?? null,
    minCash,
    fundingNeeded: Math.max(0, -minCash),
    cashOutMonth: rows.find((r) => r.cash < 0)?.i ?? null,
    endCash: rows.length ? rows[rows.length - 1].cash : i.start_cash,
  }
}
