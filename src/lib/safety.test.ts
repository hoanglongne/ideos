import { describe, expect, it } from 'vitest'
import { backupAgo, needsBackupNudge, nudgeDays, type NudgeInput } from './safety'

const DAY = 86_400_000
const NOW = 1_800_000_000_000
const base: NudgeInput = { ideaCount: 10, synced: false, lastBackup: null, oldestIdeaAt: NOW - 30 * DAY, dismissedUntil: 0, now: NOW }

describe('nhắc sao lưu', () => {
  it('chưa sao lưu bao giờ và ý tưởng cũ nhất đã 30 ngày thì nhắc', () => {
    expect(needsBackupNudge(base)).toBe(true)
    expect(nudgeDays(base)).toBe(30)
  })
  it('lần sao lưu gần nhất thắng ngày của ý tưởng cũ', () => {
    expect(needsBackupNudge({ ...base, lastBackup: NOW - 3 * DAY })).toBe(false)
    expect(needsBackupNudge({ ...base, lastBackup: NOW - 20 * DAY })).toBe(true)
  })
  it('đã bật đồng bộ thì không nhắc', () => {
    expect(needsBackupNudge({ ...base, synced: true })).toBe(false)
  })
  it('mới có vài ý tưởng thì chưa nhắc', () => {
    expect(needsBackupNudge({ ...base, ideaCount: 2 })).toBe(false)
    expect(needsBackupNudge({ ...base, ideaCount: 3 })).toBe(true)
  })
  it('đã bấm "để sau" thì im cho đến hết hạn', () => {
    expect(needsBackupNudge({ ...base, dismissedUntil: NOW + DAY })).toBe(false)
    expect(needsBackupNudge({ ...base, dismissedUntil: NOW - 1 })).toBe(true)
  })
  it('ý tưởng mới tinh (dưới 14 ngày) thì chưa nhắc', () => {
    expect(needsBackupNudge({ ...base, oldestIdeaAt: NOW - 5 * DAY })).toBe(false)
  })
  it('không có ý tưởng nào thì không nhắc', () => {
    expect(needsBackupNudge({ ...base, ideaCount: 0, oldestIdeaAt: null })).toBe(false)
  })
  it('chữ "bao lâu rồi"', () => {
    expect(backupAgo(null, NOW)).toBe('chưa lần nào')
    expect(backupAgo(NOW - 100, NOW)).toBe('hôm nay')
    expect(backupAgo(NOW - 5 * DAY, NOW)).toBe('5 ngày trước')
  })
})
