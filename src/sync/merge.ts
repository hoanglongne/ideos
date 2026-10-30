import type { Idea } from '../types'

/**
 * Gộp ba chiều cho một ý tưởng: `base` là bản đã đồng bộ lần trước (tổ tiên chung),
 * `local` là bản trên máy này, `remote` là bản từ máy chủ. Trường nào chỉ một bên đổi so với `base` thì lấy bên đó;
 * cả hai cùng đổi một trường thì bản mới hơn thắng. Nhờ vậy đổi tên trên máy này và ghi nhật ký trên máy kia
 * không đè mất nhau, dù bản của máy nào "mới hơn" cả ý tưởng.
 */

const ID_LISTS = ['journal', 'assumptions', 'evidence', 'tasks'] as const

type Obj = Record<string, unknown>
const isPlain = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)
const isPrim = (x: unknown) => x === null || ['string', 'number', 'boolean'].includes(typeof x)
const isPrimArray = (x: unknown): x is unknown[] => Array.isArray(x) && x.every(isPrim)

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    const bb = b as unknown[]
    return a.length === bb.length && a.every((x, i) => deepEqual(x, bb[i]))
  }
  const ao = a as Obj
  const bo = b as Obj
  const ka = Object.keys(ao).filter((k) => ao[k] !== undefined)
  const kb = Object.keys(bo).filter((k) => bo[k] !== undefined)
  return ka.length === kb.length && ka.every((k) => deepEqual(ao[k], bo[k]))
}

/** Gộp một giá trị bất kỳ: bằng nhau, chỉ một bên đổi, đối tượng (theo từng khoá), mảng đơn giản (theo tập), hoặc bên mới hơn thắng. */
function mergeValue(b: unknown, l: unknown, r: unknown, lNewer: boolean): unknown {
  if (deepEqual(l, r)) return l
  if (deepEqual(l, b)) return r
  if (deepEqual(r, b)) return l
  if (isPlain(l) && isPlain(r)) {
    const bb = isPlain(b) ? b : {}
    const out: Obj = {}
    for (const k of new Set([...Object.keys(l), ...Object.keys(r), ...Object.keys(bb)])) {
      const v = mergeValue(bb[k], l[k], r[k], lNewer)
      if (v !== undefined) out[k] = v
    }
    return out
  }
  if (isPrimArray(l) && isPrimArray(r)) {
    const bb = isPrimArray(b) ? b : []
    const has = (xs: unknown[], x: unknown) => xs.some((y) => deepEqual(x, y))
    // giữ phần của máy này, bỏ cái máy kia đã xoá khỏi gốc, thêm cái máy kia mới thêm
    const keptLocal = l.filter((x) => !(has(bb, x) && !has(r, x)))
    const addedRemote = r.filter((x) => !has(bb, x) && !has(l, x))
    return [...keptLocal, ...addedRemote]
  }
  return lNewer ? l : r
}

/** Danh sách mục có id (nhật ký, giả định, bằng chứng, việc): gộp từng mục, có xử lý mục bị xoá. */
function mergeById<T extends { id: string }>(b: T[], l: T[], r: T[], lNewer: boolean): T[] {
  const index = (xs: T[]) => new Map(xs.map((x) => [x.id, x]))
  const B = index(b)
  const L = index(l)
  const R = index(r)
  const order = [...l.map((x) => x.id), ...r.map((x) => x.id).filter((id) => !L.has(id))]
  const out: T[] = []
  for (const id of order) {
    const bi = B.get(id)
    const li = L.get(id)
    const ri = R.get(id)
    if (li && ri) out.push(mergeValue(bi, li, ri, lNewer) as T)
    // chỉ một bên còn mục này: bên kia xoá nó. Nếu bên còn lại chưa động tới thì xoá thật; đã sửa thì giữ để không mất công sửa.
    else if (li) {
      if (!bi || !deepEqual(li, bi)) out.push(li)
    } else if (ri) {
      if (!bi || !deepEqual(ri, bi)) out.push(ri)
    }
  }
  return out
}

export function mergeThreeWay(base: Idea, local: Idea, remote: Idea): Idea {
  const lNewer = local.updatedAt >= remote.updatedAt
  const b = base as unknown as Obj
  const l = local as unknown as Obj
  const r = remote as unknown as Obj
  const out: Obj = {}
  for (const k of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
    if ((ID_LISTS as readonly string[]).includes(k)) out[k] = mergeById((b[k] ?? []) as { id: string }[], (l[k] ?? []) as { id: string }[], (r[k] ?? []) as { id: string }[], lNewer)
    else if (k === 'id' || k === 'createdAt') out[k] = l[k] ?? r[k]
    else if (k === 'updatedAt') out[k] = Math.max(local.updatedAt, remote.updatedAt)
    else {
      const v = mergeValue(b[k], l[k], r[k], lNewer)
      if (v !== undefined) out[k] = v
    }
  }
  const merged = out as unknown as Idea
  merged.journal = [...merged.journal].sort((x, y) => x.at - y.at)
  return merged
}

/** Hai ý tưởng giống nhau về nội dung (bỏ qua updatedAt). */
export const sameContent = (a: Idea, b: Idea) => deepEqual({ ...a, updatedAt: 0 }, { ...b, updatedAt: 0 })
