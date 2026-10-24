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

export const KINDS: { value: IdeaKind; label: string; emoji: string }[] = [
  { value: 'web', label: 'Web', emoji: '🌐' },
  { value: 'app', label: 'App', emoji: '📱' },
  { value: 'startup', label: 'Startup', emoji: '🚀' },
  { value: 'product', label: 'Sản phẩm', emoji: '📦' },
  { value: 'feature', label: 'Tính năng', emoji: '🧩' },
  { value: 'other', label: 'Khác', emoji: '💡' },
]

export const STATUSES: { value: IdeaStatus; label: string; color: string }[] = [
  { value: 'spark', label: 'Mới nảy ra', color: '#ffc94d' },
  { value: 'exploring', label: 'Đang nghĩ', color: '#7cc4ff' },
  { value: 'validating', label: 'Kiểm chứng', color: '#b892ff' },
  { value: 'building', label: 'Đang làm', color: '#5fd39a' },
  { value: 'shipped', label: 'Đã ra mắt', color: '#3ecf8e' },
  { value: 'parked', label: 'Để sau', color: '#9aa3b2' },
  { value: 'dropped', label: 'Bỏ', color: '#ff7a7a' },
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
