/**
 * Trần dung lượng mỗi kho. Phần thuần (không phụ thuộc D1) để test được:
 * tính xem một lần ghi làm kho nặng thêm hay nhẹ đi bao nhiêu byte.
 */

export const DEFAULT_VAULT_MB = 300

export const capBytes = (mb: string | undefined) => (Number(mb ?? DEFAULT_VAULT_MB) || DEFAULT_VAULT_MB) * 1_000_000

export interface OldIdea {
  n: number
  updatedAt: number
}

/**
 * Ý tưởng: chỉ dòng "bản mới hơn thắng" mới thay dòng cũ (giống câu SQL ON CONFLICT ... WHERE excluded.updated_at >= ideas.updated_at).
 * Cùng một id xuất hiện hai lần trong một lần gửi thì tính tuần tự.
 */
export function ideasDelta(rows: { id: string; data: string | null; updatedAt: number; deleted: boolean }[], old: Map<string, OldIdea>): number {
  const state = new Map(old)
  let delta = 0
  for (const r of rows) {
    const prev = state.get(r.id)
    if (prev && r.updatedAt < prev.updatedAt) continue
    const n = r.deleted || r.data == null ? 0 : r.data.length
    delta += n - (prev?.n ?? 0)
    state.set(r.id, { n, updatedAt: r.updatedAt })
  }
  return delta
}

/** Đính kèm: luôn ghi đè. */
export function attachmentsDelta(rows: { id: string; meta: string | null; deleted: boolean }[], old: Map<string, number>): number {
  const state = new Map(old)
  let delta = 0
  for (const r of rows) {
    const n = r.deleted || r.meta == null ? 0 : r.meta.length
    delta += n - (state.get(r.id) ?? 0)
    state.set(r.id, n)
  }
  return delta
}

/** Ghi thêm thì không được vượt trần; xoá bớt (delta âm) luôn được phép để người dùng tự dọn. */
export const exceeds = (used: number, delta: number, cap: number) => delta > 0 && used + delta > cap

export const fullMessage = (cap: number) =>
  `Kho đồng bộ đã đầy (${Math.round(cap / 1_000_000)} MB). Xoá bớt ảnh hoặc ghi âm cũ, hoặc tăng MAX_VAULT_MB trong wrangler.jsonc.`
