// Chuyển kế hoạch tiền của một ý tưởng sang Sổ Cái (dự án observer) khi ý tưởng đã thành sản phẩm.
// Định dạng là file JSON "một dự án" mà Sổ Cái nhập được qua ⚙ → Sao lưu & nhập file → Nhập.

import { fold } from '../util'
import type { Idea } from '../../types'
import type { ModelId, PlanInputs } from './models'

const APP_TAG = 'so-cai-unit-economics'
const FORMAT_VERSION = 1

/** Tỉ lệ khách tiềm năng ra khách trả tiền: Sổ Cái cần, Ideos không hỏi. Lấy theo mẫu của Sổ Cái. */
const CONVERSION_PCT: Record<ModelId, number> = { saas: 2, mobile_app: 4, ecommerce: 1.5, marketplace: 2, fnb: 5, services: 20, course: 3, content: 10 }

export interface ObserverFile {
  app: typeof APP_TAG
  version: number
  kind: 'project'
  exported_at: string
  data: {
    projects: Record<string, unknown>[]
    plans: Record<string, unknown>[]
    monthly: never[]
    costs: never[]
    shared_costs: never[]
    marketing: never[]
    scenarios: never[]
  }
}

const slug = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)

/** Mã dự án cố định theo ý tưởng: xuất lại lần sau thì cập nhật cùng dự án, không đẻ thêm bản trùng. */
export const observerProjectId = (idea: Pick<Idea, 'id' | 'title'>) => `${slug(idea.title) || 'y-tuong'}-${idea.id.replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase()}`

export function toObserverFile(idea: Idea, now = new Date()): ObserverFile {
  if (!idea.money) throw new Error('Ý tưởng chưa có bài toán tiền')
  const i = idea.money.inputs
  const id = observerProjectId(idea)
  const planId = 'plan-' + id
  const name = idea.title.trim() || 'Ý tưởng chưa đặt tên'
  const created = new Date(idea.createdAt).toISOString()
  const inputs: PlanInputs & { founder_salary: number; conversion_pct: number; budget_growth_pct: number; budget_cap: number; target_months: number } = {
    ...i,
    founder_salary: 0,
    conversion_pct: CONVERSION_PCT[i.model],
    budget_growth_pct: 0,
    budget_cap: 0,
    target_months: 12,
  }
  return {
    app: APP_TAG,
    version: FORMAT_VERSION,
    kind: 'project',
    exported_at: now.toISOString(),
    data: {
      projects: [
        {
          id,
          name,
          description: `Từ ý tưởng trong Ideos${idea.body ? ': ' + idea.body.replace(/\s+/g, ' ').slice(0, 200) : ''}`,
          currency: i.currency,
          usd_to_vnd: 25_500,
          color: '#1b6e66',
          status: 'active',
          labor_rate: null,
          include_labor: false,
          default_lifetime_months: null,
          cash: i.start_cash || null,
          model: i.model,
          plan_id: planId,
          created_at: created,
        },
      ],
      plans: [{ id: planId, name, start_month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, inputs, assumed: idea.money.assumed, created_at: created }],
      monthly: [],
      costs: [],
      shared_costs: [],
      marketing: [],
      scenarios: [],
    },
  }
}

export const observerFileName = (idea: Pick<Idea, 'id' | 'title'>) => `so-cai-${observerProjectId(idea)}.json`
