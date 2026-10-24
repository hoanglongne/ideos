import type { Idea, IdeaKind } from '../types'
import { KINDS } from '../types'

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2)

/** Bỏ dấu tiếng Việt + lowercase để tìm kiếm "y tuong" khớp "Ý tưởng". */
export function fold(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

const TAG_RE = /(^|\s)#([\p{L}\p{N}_-]+)/gu
const KIND_RE = /(^|\s)@(web|app|startup|product|feature|other)\b/gi

export interface ParsedCapture {
  title: string
  body: string
  tags: string[]
  kind?: IdeaKind
}

/**
 * Cú pháp ghi nhanh:
 *   dòng đầu = tiêu đề, phần còn lại = ghi chú
 *   #tag     → gắn tag
 *   @app     → loại (web, app, startup, product, feature, other)
 */
export function parseCapture(raw: string): ParsedCapture {
  const tags = new Set<string>()
  let kind: IdeaKind | undefined
  for (const m of raw.matchAll(TAG_RE)) tags.add(m[2].toLowerCase())
  for (const m of raw.matchAll(KIND_RE)) kind = m[2].toLowerCase() as IdeaKind
  const cleaned = raw.replace(KIND_RE, '$1').replace(TAG_RE, '$1')
  const lines = cleaned.split('\n')
  const firstIdx = lines.findIndex((l) => l.trim())
  let title = firstIdx >= 0 ? lines[firstIdx].trim().replace(/\s+/g, ' ') : ''
  let body = firstIdx >= 0 ? lines.slice(firstIdx + 1).join('\n').trim() : ''
  if (title.length > 120) {
    body = (title + (body ? '\n' + body : '')).trim()
    title = title.slice(0, 80).replace(/\s\S*$/, '') + '…'
  }
  return { title, body, tags: [...tags], kind }
}

/** Điểm ICE 0..10, hoặc null nếu chưa chấm đủ. */
export function iceScore(idea: Pick<Idea, 'scores'>): number | null {
  const { impact, confidence, ease } = idea.scores
  if (!impact || !confidence || !ease) return null
  return Math.round(((impact * confidence * ease) / 100) * 10) / 10
}

export function matchesQuery(idea: Idea, q: string) {
  if (!q.trim()) return true
  const hay = fold(
    [idea.title, idea.body, idea.tags.map((t) => '#' + t).join(' '), Object.values(idea.canvas).join(' '), idea.tasks.map((t) => t.text).join(' ')].join(' '),
  )
  return fold(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => hay.includes(tok))
}

const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('vi', { numeric: 'auto' }) : null

export function timeAgo(ts: number) {
  const diff = (ts - Date.now()) / 1000
  const abs = Math.abs(diff)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, sec] of units) {
    if (abs >= sec) return rtf ? rtf.format(Math.round(diff / sec), unit) : new Date(ts).toLocaleDateString()
  }
  return 'vừa xong'
}

export const kindMeta = (k: IdeaKind) => KINDS.find((x) => x.value === k) ?? KINDS[KINDS.length - 1]

export function formatDuration(sec: number) {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Thu nhỏ ảnh về cạnh dài tối đa `max` px để tiết kiệm dung lượng. */
export async function downscaleImage(file: Blob, max = 1600, quality = 0.85): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    if (scale === 1 && file.size < 600_000) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/jpeg', quality))
  } catch {
    return file
  }
}
