// Giữ ý tưởng không bị mất: nhắc sao lưu khi dữ liệu chỉ nằm trên một máy.

const LAST_KEY = 'ideos:lastBackup'
const DISMISS_KEY = 'ideos:backupNudgeUntil'

export const NUDGE_AFTER_DAYS = 14
export const DISMISS_DAYS = 7
const DAY = 86_400_000

const read = (k: string) => {
  try {
    return Number(localStorage.getItem(k)) || null
  } catch {
    return null
  }
}
const write = (k: string, v: number) => {
  try {
    localStorage.setItem(k, String(v))
  } catch {
    /* chế độ riêng tư: không lưu được thì nhắc lại lần sau */
  }
}

export const lastBackupAt = () => read(LAST_KEY)
export const markBackup = (now = Date.now()) => write(LAST_KEY, now)
export const dismissNudge = (now = Date.now()) => write(DISMISS_KEY, now + DISMISS_DAYS * DAY)
export const nudgeDismissedUntil = () => read(DISMISS_KEY) ?? 0

export interface NudgeInput {
  ideaCount: number
  /** Đã bật đồng bộ: dữ liệu đã có bản thứ hai trên máy chủ */
  synced: boolean
  lastBackup: number | null
  oldestIdeaAt: number | null
  dismissedUntil: number
  now: number
}

/** Mốc tính "bao lâu chưa sao lưu": lần sao lưu gần nhất, chưa có thì ngày của ý tưởng cũ nhất. */
export function nudgeDays(i: NudgeInput): number | null {
  const ref = i.lastBackup ?? i.oldestIdeaAt
  return ref == null ? null : Math.floor((i.now - ref) / DAY)
}

/**
 * Khi nào nhắc: chưa bật đồng bộ, đã có vài ý tưởng đáng mất, quá hạn chưa sao lưu, và chưa bấm "để sau".
 * Mới dùng vài ý tưởng thì chưa nhắc, tránh làm phiền người mới.
 */
export function needsBackupNudge(i: NudgeInput): boolean {
  if (i.synced || i.ideaCount < 3 || i.dismissedUntil > i.now) return false
  const d = nudgeDays(i)
  return d != null && d >= NUDGE_AFTER_DAYS
}

/** "chưa lần nào" / "hôm nay" / "5 ngày trước" */
export function backupAgo(last: number | null, now = Date.now()): string {
  if (last == null) return 'chưa lần nào'
  const d = Math.floor((now - last) / DAY)
  return d <= 0 ? 'hôm nay' : `${d} ngày trước`
}
