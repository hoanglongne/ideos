import type { Idea, IdeaStatus } from '../types'
import { iceScore } from './util'

/**
 * Đường đi của một ý tưởng: Ghi → Mài → Thử → Quyết → Làm → Theo dõi.
 * Mỗi lúc chỉ có MỘT bước tiếp theo, tính từ chính trạng thái của ý tưởng; app đưa bước đó lên đầu mọi màn hình.
 */

export type SectionId = 'journal' | 'assumptions' | 'evidence' | 'money' | 'tasks' | 'canvas' | 'details'
export type StepKind = 'coach' | 'advance' | 'test' | 'money' | 'decide' | 'task' | 'ship' | 'track' | 'resume'

export interface Step {
  kind: StepKind
  title: string
  why: string
  cta: string
  /** Phần của trang ý tưởng cần mở sẵn để làm bước này */
  section: SectionId | null
  /** Giả định đang được nhắc tới (bước "thử") */
  assumptionId?: string
  /** Việc đang được nhắc tới (bước "làm") */
  taskId?: string
  risk?: 1 | 2 | 3
  /** Bấm nút chính thì chuyển sang giai đoạn này */
  advanceTo?: IdeaStatus
}

/** Năm chặng trên thanh hành trình. Gác lại / bỏ nằm ngoài đường đi. */
export const STAGES: { status: IdeaStatus; label: string }[] = [
  { status: 'spark', label: 'Ghi' },
  { status: 'exploring', label: 'Mài' },
  { status: 'validating', label: 'Thử' },
  { status: 'building', label: 'Làm' },
  { status: 'shipped', label: 'Ra mắt' },
]

export const stageIndex = (s: IdeaStatus) => STAGES.findIndex((x) => x.status === s)

const openAssumptions = (i: Idea) =>
  i.assumptions
    .filter((a) => a.status === 'untested' || a.status === 'testing')
    .sort((a, b) => b.risk - a.risk || a.createdAt - b.createdAt)

export function nextStep(idea: Idea): Step {
  const s = idea.status
  if (s === 'parked' || s === 'dropped')
    return { kind: 'resume', title: s === 'parked' ? 'Đang để sau' : 'Đã bỏ', why: 'Chưa có gì cần làm. Khi sẵn sàng thì mở lại ý tưởng này.', cta: 'Mở lại', section: null, advanceTo: 'exploring' }

  if (s === 'shipped')
    return idea.money
      ? { kind: 'track', title: 'Theo dõi số thật', why: 'Đưa kế hoạch sang Sổ Cái để mỗi tháng so kế hoạch với số thật.', cta: 'Mở bài toán tiền', section: 'money' }
      : { kind: 'track', title: 'Tính xem sản phẩm này kiếm được bao nhiêu', why: 'Đã ra mắt mà chưa có bài toán tiền. Vài con số là đủ để biết đang đi đúng không.', cta: 'Thêm bài toán tiền', section: 'money' }

  if (s === 'building') {
    const t = idea.tasks.find((x) => !x.done)
    if (t) return { kind: 'task', title: t.text, why: 'Việc tiếp theo bạn đã ghi.', cta: 'Xong việc này', section: 'tasks', taskId: t.id }
    return { kind: 'ship', title: 'Sẵn sàng ra mắt?', why: 'Danh sách việc đã hết. Ra mắt rồi thì theo dõi số thật.', cta: 'Đánh dấu đã ra mắt', section: null, advanceTo: 'shipped' }
  }

  // spark, exploring, validating
  const needsBasics = !idea.canvas.problem.trim() || !idea.canvas.audience.trim()
  if (needsBasics && (s === 'spark' || s === 'exploring'))
    return { kind: 'coach', title: 'Mài ý tưởng', why: 'Mới có cái tên. Trả lời vài câu để rõ ai đang đau và vì sao.', cta: 'Bắt đầu mài', section: null }

  if (!idea.assumptions.length)
    return { kind: 'coach', title: 'Tìm điều phải đúng', why: 'Ý tưởng chỉ sống được nếu vài điều là đúng. Ghi chúng ra, rồi thử cái rủi ro nhất.', cta: 'Mài để tìm giả định', section: null }

  if (s === 'spark' || s === 'exploring')
    return {
      kind: 'advance',
      title: 'Sẵn sàng kiểm chứng?',
      why: `Bạn đã có ${idea.assumptions.length} giả định. Chuyển sang Kiểm chứng để thử cái rủi ro nhất.`,
      cta: 'Chuyển sang Kiểm chứng',
      section: 'assumptions',
      advanceTo: 'validating',
    }

  // validating
  const open = openAssumptions(idea)
  if (open.length) {
    const a = open[0]
    return {
      kind: 'test',
      title: a.text,
      why: a.test.trim() || 'Chưa có cách thử. Nghĩ một việc rẻ nhất làm được trong tuần này.',
      cta: 'Ghi bằng chứng',
      section: 'assumptions',
      assumptionId: a.id,
      risk: a.risk,
    }
  }
  if (!idea.money) return { kind: 'money', title: 'Tính xem có đứng được về tiền không', why: 'Các giả định đã có kết quả. Giờ thử bằng con số.', cta: 'Tính bài toán tiền', section: 'money' }
  return { kind: 'decide', title: 'Đi tiếp hay dừng?', why: 'Các giả định đã được thử và có bài toán tiền. Chấm điểm rồi quyết định.', cta: 'Quyết định', section: null }
}

const RANK: Record<StepKind, number> = { test: 100, decide: 95, money: 75, advance: 70, coach: 60, ship: 55, task: 50, track: 30, resume: 0 }
const ACTIVE: IdeaStatus[] = ['spark', 'exploring', 'validating', 'building']

export interface PlanItem {
  idea: Idea
  step: Step
  rank: number
}

/** Việc nên làm hôm nay trên mọi ý tưởng đang sống: giả định rủi ro cao nhất trước, rồi tới ý tưởng được chấm điểm cao. */
export function todayPlan(ideas: Idea[], limit = 3): PlanItem[] {
  return ideas
    .filter((i) => ACTIVE.includes(i.status))
    .map((idea) => {
      const step = nextStep(idea)
      return { idea, step, rank: RANK[step.kind] + (step.risk ?? 0) * 5 + (iceScore(idea) ?? 0) / 2 }
    })
    .sort((a, b) => b.rank - a.rank || b.idea.updatedAt - a.idea.updatedAt)
    .slice(0, limit)
}

/** Một dòng cho danh sách: việc tiếp theo của ý tưởng này là gì. */
export function stepLabel(step: Step): string {
  switch (step.kind) {
    case 'test':
      return 'Thử: ' + step.title
    case 'task':
      return 'Làm: ' + step.title
    default:
      return step.title
  }
}
