export type IdeaKind = 'web' | 'app' | 'startup' | 'product' | 'feature' | 'other'
export type IdeaStatus = 'spark' | 'exploring' | 'validating' | 'building' | 'shipped' | 'parked' | 'dropped'

export interface Scores {
  impact: number // 0 = chưa chấm, 1..10
  confidence: number
  ease: number
}

export interface Canvas {
  problem: string
  audience: string
  solution: string
  monetization: string
  competitors: string
  unfair: string
}

export interface Task {
  id: string
  text: string
  done: boolean
}

/** Một dòng trong nhật ký: suy nghĩ thêm, kết quả một phiên mài, lời phản biện của AI, đổi giai đoạn… */
export type JournalKind = 'note' | 'coach' | 'ai' | 'status'

export interface JournalEntry {
  id: string
  at: number
  kind: JournalKind
  text: string
}

export type AssumptionStatus = 'untested' | 'testing' | 'holds' | 'broken'

/** Điều phải đúng thì ý tưởng mới sống, kèm cách thử rẻ nhất. */
export interface Assumption {
  id: string
  text: string
  risk: 1 | 2 | 3 // 3 = sai thì ý tưởng chết
  test: string
  status: AssumptionStatus
  createdAt: number
}

export type Signal = 'for' | 'against' | 'neutral'

/** Một mẩu bằng chứng thật: câu nói của người dùng, một con số, một quan sát. */
export interface Evidence {
  id: string
  at: number
  text: string
  source: string
  signal: Signal
  assumptionId?: string
}

export interface GeoStamp {
  lat: number
  lng: number
  accuracy: number
}

export interface Idea {
  id: string
  title: string
  body: string
  kind: IdeaKind
  status: IdeaStatus
  tags: string[]
  pinned: boolean
  scores: Scores
  canvas: Canvas
  tasks: Task[]
  links: string[]
  related: string[]
  journal: JournalEntry[]
  assumptions: Assumption[]
  evidence: Evidence[]
  location?: GeoStamp
  createdAt: number
  updatedAt: number
  reviewedAt?: number
}

export type AttachmentType = 'audio' | 'image' | 'sketch'

export interface Attachment {
  id: string
  ideaId: string
  type: AttachmentType
  blob: Blob
  mime: string
  createdAt: number
  duration?: number
}

export const KINDS: { value: IdeaKind; label: string }[] = [
  { value: 'web', label: 'Web' },
  { value: 'app', label: 'App' },
  { value: 'startup', label: 'Startup' },
  { value: 'product', label: 'Sản phẩm' },
  { value: 'feature', label: 'Tính năng' },
  { value: 'other', label: 'Khác' },
]

/**
 * Trạng thái là một chuỗi tiến trình, không phải 7 nhãn màu:
 * neutral = chưa động tới, accent = đang tiến hành, positive = đã ra mắt, muted = đã gác lại.
 */
export type StatusTone = 'neutral' | 'accent' | 'positive' | 'muted'

export const STATUSES: { value: IdeaStatus; label: string; tone: StatusTone }[] = [
  { value: 'spark', label: 'Mới nảy ra', tone: 'neutral' },
  { value: 'exploring', label: 'Đang nghĩ', tone: 'accent' },
  { value: 'validating', label: 'Kiểm chứng', tone: 'accent' },
  { value: 'building', label: 'Đang làm', tone: 'accent' },
  { value: 'shipped', label: 'Đã ra mắt', tone: 'positive' },
  { value: 'parked', label: 'Để sau', tone: 'muted' },
  { value: 'dropped', label: 'Đã bỏ', tone: 'muted' },
]

/** Các trạng thái còn "sống": được đưa vào hàng chờ ôn lại. */
export const REVIEWABLE: IdeaStatus[] = ['spark', 'exploring', 'validating', 'building', 'parked']

export const ASSUMPTION_STATUSES: { value: AssumptionStatus; label: string; tone: StatusTone }[] = [
  { value: 'untested', label: 'Chưa thử', tone: 'neutral' },
  { value: 'testing', label: 'Đang thử', tone: 'accent' },
  { value: 'holds', label: 'Đúng', tone: 'positive' },
  { value: 'broken', label: 'Sai', tone: 'muted' },
]

export const RISKS: { value: Assumption['risk']; label: string }[] = [
  { value: 3, label: 'Rủi ro cao' },
  { value: 2, label: 'Vừa' },
  { value: 1, label: 'Thấp' },
]

export const SIGNALS: { value: Signal; label: string }[] = [
  { value: 'for', label: 'Ủng hộ' },
  { value: 'against', label: 'Phản bác' },
  { value: 'neutral', label: 'Chưa rõ' },
]

export const CANVAS_FIELDS: { key: keyof Canvas; label: string; hint: string }[] = [
  { key: 'problem', label: 'Vấn đề', hint: 'Nỗi đau cụ thể là gì? Ai đang chịu?' },
  { key: 'audience', label: 'Người dùng', hint: 'Ai cần nhất? Tìm họ ở đâu?' },
  { key: 'solution', label: 'Giải pháp', hint: 'Phiên bản nhỏ nhất (MVP) trông thế nào?' },
  { key: 'monetization', label: 'Kiếm tiền', hint: 'Ai trả tiền, trả bao nhiêu, cho cái gì?' },
  { key: 'competitors', label: 'Đối thủ / thay thế', hint: 'Hiện họ đang giải quyết bằng cách nào?' },
  { key: 'unfair', label: 'Lợi thế riêng', hint: 'Vì sao bạn làm được tốt hơn người khác?' },
]

export const emptyCanvas = (): Canvas => ({
  problem: '',
  audience: '',
  solution: '',
  monetization: '',
  competitors: '',
  unfair: '',
})
