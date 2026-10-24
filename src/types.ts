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
