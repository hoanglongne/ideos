/**
 * Bài toán tiền của một ý tưởng: 8 mô hình kinh doanh, mỗi mô hình có số trung bình làm điểm xuất phát.
 * Port rút gọn từ dự án observer ("Sổ Cái"); số mặc định là ước lượng thô để có chỗ bắt đầu, không phải số liệu thị trường.
 */

export type Currency = 'VND' | 'USD'
export type ModelId = 'saas' | 'mobile_app' | 'ecommerce' | 'marketplace' | 'fnb' | 'services' | 'course' | 'content'
export type GoalType = 'breakeven' | 'profit' | 'salary'

/** Cách quy doanh thu về "mỗi khách mỗi tháng" */
export type PlanMode = 'subscription' | 'transaction' | 'marketplace' | 'audience'

export interface PlanInputs {
  model: ModelId
  currency: Currency
  /** Giá gói/tháng (thuê bao), giá trị đơn (giao dịch), GMV mỗi giao dịch (sàn), RPM (nội dung) */
  price: number
  /** Số đơn mỗi khách mỗi tháng khi còn mua (giao dịch, sàn) / số lượt xem mỗi người (nội dung) */
  orders_per_month: number
  /** Khách mua lại, % */
  repeat_pct: number
  /** Phần sàn giữ lại, % GMV */
  take_rate_pct: number
  /** Khách rời đi mỗi tháng, % */
  churn_pct: number
  /** Chi phí biến đổi, % doanh thu */
  var_cost_pct: number
  fee_pct: number
  tax_pct: number
  /** Chi phí cố định mỗi tháng, chưa gồm lương bản thân */
  fixed_cost: number
  /** Chi phí để có một khách trả tiền */
  cac: number
  /** Ngân sách marketing mỗi tháng */
  marketing_budget: number
  /** Khách mới tự đến mỗi tháng (giới thiệu, SEO…) */
  organic_new: number
  start_customers: number
  start_cash: number
  goal_type: GoalType
  /** Lãi mục tiêu mỗi tháng (goal 'profit') hoặc lương mong muốn (goal 'salary') */
  goal_amount: number
  /** Số tháng mô phỏng */
  horizon: number
}

export type InputKey = keyof PlanInputs

export interface MoneyPlan {
  inputs: PlanInputs
  /** Ô còn đang là số trung bình của mô hình, chưa phải số bạn tự nhập */
  assumed: InputKey[]
}

type ByCur = Record<Currency, number>

interface Defaults {
  price: ByCur
  orders_per_month: number
  repeat_pct: number
  take_rate_pct: number
  churn_pct: number
  var_cost_pct: number
  fee_pct: ByCur
  tax_pct: ByCur
  cac: ByCur
  fixed_cost: ByCur
}

export interface ModelTemplate {
  id: ModelId
  name: string
  planMode: PlanMode
  /** Gọi người trả tiền là gì */
  customer: string
  priceLabel: string
  /** Giá tính theo đơn vị nào, dùng trong câu giả định */
  priceUnit: string
  defaults: Defaults
}

const TAX_SERVICE: ByCur = { VND: 7, USD: 0 }

export const MODELS: Record<ModelId, ModelTemplate> = {
  saas: {
    id: 'saas',
    name: 'SaaS / phần mềm thuê bao',
    planMode: 'subscription',
    customer: 'khách',
    priceLabel: 'Giá gói trung bình mỗi tháng',
    priceUnit: 'mỗi tháng',
    defaults: {
      price: { VND: 199_000, USD: 19 },
      orders_per_month: 1,
      repeat_pct: 0,
      take_rate_pct: 0,
      churn_pct: 5,
      var_cost_pct: 15,
      fee_pct: { VND: 2, USD: 4 },
      tax_pct: TAX_SERVICE,
      cac: { VND: 500_000, USD: 50 },
      fixed_cost: { VND: 3_000_000, USD: 150 },
    },
  },
  mobile_app: {
    id: 'mobile_app',
    name: 'App di động thuê bao',
    planMode: 'subscription',
    customer: 'người dùng trả phí',
    priceLabel: 'Giá gói trung bình mỗi tháng (trước phí store)',
    priceUnit: 'mỗi tháng',
    defaults: {
      price: { VND: 79_000, USD: 6.99 },
      orders_per_month: 1,
      repeat_pct: 0,
      take_rate_pct: 0,
      churn_pct: 10,
      var_cost_pct: 10,
      fee_pct: { VND: 15, USD: 15 },
      tax_pct: { VND: 0, USD: 0 },
      cac: { VND: 300_000, USD: 30 },
      fixed_cost: { VND: 1_500_000, USD: 80 },
    },
  },
  ecommerce: {
    id: 'ecommerce',
    name: 'Bán hàng online',
    planMode: 'transaction',
    customer: 'khách',
    priceLabel: 'Giá trị đơn trung bình',
    priceUnit: 'mỗi đơn',
    defaults: {
      price: { VND: 350_000, USD: 60 },
      orders_per_month: 0.5,
      repeat_pct: 28,
      take_rate_pct: 0,
      churn_pct: 0,
      var_cost_pct: 50,
      fee_pct: { VND: 15, USD: 3 },
      tax_pct: { VND: 1.5, USD: 0 },
      cac: { VND: 120_000, USD: 35 },
      fixed_cost: { VND: 5_000_000, USD: 300 },
    },
  },
  marketplace: {
    id: 'marketplace',
    name: 'Sàn / nền tảng kết nối',
    planMode: 'marketplace',
    customer: 'người mua',
    priceLabel: 'Giá trị trung bình mỗi giao dịch (GMV)',
    priceUnit: 'mỗi giao dịch',
    defaults: {
      price: { VND: 500_000, USD: 80 },
      orders_per_month: 0.6,
      repeat_pct: 40,
      take_rate_pct: 15,
      churn_pct: 0,
      var_cost_pct: 20,
      fee_pct: { VND: 0, USD: 0 },
      tax_pct: TAX_SERVICE,
      cac: { VND: 150_000, USD: 25 },
      fixed_cost: { VND: 8_000_000, USD: 500 },
    },
  },
  fnb: {
    id: 'fnb',
    name: 'Quán ăn uống / bán lẻ tại chỗ',
    planMode: 'transaction',
    customer: 'khách',
    priceLabel: 'Hoá đơn trung bình',
    priceUnit: 'mỗi hoá đơn',
    defaults: {
      price: { VND: 80_000, USD: 15 },
      orders_per_month: 2,
      repeat_pct: 50,
      take_rate_pct: 0,
      churn_pct: 0,
      var_cost_pct: 35,
      fee_pct: { VND: 8, USD: 8 },
      tax_pct: { VND: 4.5, USD: 0 },
      cac: { VND: 30_000, USD: 6 },
      fixed_cost: { VND: 40_000_000, USD: 6_000 },
    },
  },
  services: {
    id: 'services',
    name: 'Dịch vụ / agency / freelance',
    planMode: 'subscription',
    customer: 'khách hàng',
    priceLabel: 'Doanh thu trung bình mỗi khách mỗi tháng',
    priceUnit: 'mỗi tháng',
    defaults: {
      price: { VND: 15_000_000, USD: 2_000 },
      orders_per_month: 1,
      repeat_pct: 0,
      take_rate_pct: 0,
      churn_pct: 8,
      var_cost_pct: 45,
      fee_pct: { VND: 0, USD: 3 },
      tax_pct: TAX_SERVICE,
      cac: { VND: 5_000_000, USD: 800 },
      fixed_cost: { VND: 10_000_000, USD: 800 },
    },
  },
  course: {
    id: 'course',
    name: 'Khoá học / sản phẩm số',
    planMode: 'transaction',
    customer: 'học viên',
    priceLabel: 'Giá bán trung bình',
    priceUnit: 'mỗi lần mua',
    defaults: {
      price: { VND: 1_500_000, USD: 199 },
      orders_per_month: 0.15,
      repeat_pct: 20,
      take_rate_pct: 0,
      churn_pct: 0,
      var_cost_pct: 10,
      fee_pct: { VND: 3, USD: 5 },
      tax_pct: TAX_SERVICE,
      cac: { VND: 500_000, USD: 100 },
      fixed_cost: { VND: 2_000_000, USD: 150 },
    },
  },
  content: {
    id: 'content',
    name: 'Nội dung / quảng cáo',
    planMode: 'audience',
    customer: 'người đọc',
    priceLabel: 'Doanh thu mỗi 1.000 lượt xem (RPM)',
    priceUnit: 'mỗi 1.000 lượt xem',
    defaults: {
      price: { VND: 120_000, USD: 12 },
      orders_per_month: 4,
      repeat_pct: 0,
      take_rate_pct: 0,
      churn_pct: 30,
      var_cost_pct: 5,
      fee_pct: { VND: 0, USD: 0 },
      tax_pct: TAX_SERVICE,
      cac: { VND: 2_000, USD: 0.2 },
      fixed_cost: { VND: 5_000_000, USD: 300 },
    },
  },
}

export const MODEL_IDS = Object.keys(MODELS) as ModelId[]

/** Các ô lấy từ số trung bình của mô hình; đổi mô hình thì ô nào bạn chưa sửa sẽ lấy lại số mới. */
export const MODEL_DEFAULT_KEYS: InputKey[] = ['price', 'orders_per_month', 'repeat_pct', 'take_rate_pct', 'churn_pct', 'var_cost_pct', 'fee_pct', 'tax_pct', 'fixed_cost', 'cac', 'marketing_budget']

export function defaultInputs(model: ModelId, currency: Currency): PlanInputs {
  const d = MODELS[model].defaults
  return {
    model,
    currency,
    price: d.price[currency],
    orders_per_month: d.orders_per_month,
    repeat_pct: d.repeat_pct,
    take_rate_pct: d.take_rate_pct,
    churn_pct: d.churn_pct,
    var_cost_pct: d.var_cost_pct,
    fee_pct: d.fee_pct[currency],
    tax_pct: d.tax_pct[currency],
    fixed_cost: d.fixed_cost[currency],
    cac: d.cac[currency],
    marketing_budget: d.cac[currency] * 10,
    organic_new: 0,
    start_customers: 0,
    start_cash: 0,
    goal_type: 'breakeven',
    goal_amount: 0,
    horizon: 24,
  }
}

export function newMoneyPlan(model: ModelId, currency: Currency): MoneyPlan {
  return { inputs: defaultInputs(model, currency), assumed: [...MODEL_DEFAULT_KEYS] }
}

const MONEY_KEYS: InputKey[] = ['price', 'fixed_cost', 'cac', 'marketing_budget', 'start_cash', 'goal_amount']

/**
 * Đổi mô hình hoặc tiền tệ: giữ số bạn đã nhập, chỉ thay các ô còn đang là số trung bình.
 * Đổi tiền tệ thì mọi ô là tiền đều quay về số trung bình (số cũ tính bằng tiền khác), tỉ lệ % thì giữ.
 */
export function switchModel(plan: MoneyPlan, model: ModelId, currency: Currency): MoneyPlan {
  const fresh = defaultInputs(model, currency)
  const inputs: PlanInputs = { ...plan.inputs, model, currency }
  const assumed = new Set(plan.assumed)
  if (plan.inputs.currency !== currency) for (const k of MONEY_KEYS) assumed.add(k)
  for (const k of assumed) (inputs[k] as number) = fresh[k] as number
  return { inputs, assumed: [...assumed] }
}

/** Các ô nhập cần hiện cho từng cách tính doanh thu */
export function fieldsFor(mode: PlanMode): InputKey[] {
  const core: InputKey[] = ['price']
  if (mode === 'subscription') core.push('churn_pct')
  if (mode === 'audience') core.push('orders_per_month', 'churn_pct')
  if (mode === 'transaction') core.push('orders_per_month', 'repeat_pct')
  if (mode === 'marketplace') core.push('orders_per_month', 'repeat_pct', 'take_rate_pct')
  return [...core, 'var_cost_pct', 'cac', 'marketing_budget', 'fixed_cost', 'start_cash']
}
