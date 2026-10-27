import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Attachment, Idea, JournalEntry } from './types'
import { emptyCanvas } from './types'
import { uid } from './lib/util'
import { IS_DEMO, demoIdeas } from './lib/demo'

/**
 * Đồng bộ: mọi bản ghi có cờ `dirty` (1 = có thay đổi chưa đẩy lên server).
 * Hook tự bật cờ cho add/update/modify, trừ khi bản ghi mang `_remote: true`
 * (dữ liệu vừa kéo về / vừa được server xác nhận) — khi đó cờ được tắt.
 * Riêng `put()` đè lên bản ghi đã có thì kết quả hook không đáng tin: luôn ghi `dirty` tường minh.
 */
export interface SyncFlags {
  dirty?: 0 | 1
  _remote?: true
}

export interface Tombstone {
  key: string // `${table}:${id}`
  table: 'ideas' | 'attachments'
  id: string
  deletedAt: number
}

export interface MetaRow {
  key: string
  value: unknown
}

export type IdeosDB = Dexie & {
  ideas: EntityTable<Idea & SyncFlags, 'id'>
  attachments: EntityTable<Attachment & SyncFlags, 'id'>
  tombstones: EntityTable<Tombstone, 'key'>
  meta: EntityTable<MetaRow, 'key'>
}

type ChangeListener = () => void
const changeListeners = new Set<ChangeListener>()
/** Được gọi mỗi khi người dùng sửa dữ liệu trên máy (không tính dữ liệu từ server). */
export const onLocalChange = (fn: ChangeListener) => {
  changeListeners.add(fn)
  return () => changeListeners.delete(fn)
}
// Hook chạy bên trong transaction; setTimeout + ignoreTransaction để listener
// không bị kẹt vào transaction đó (Dexie truyền ngữ cảnh qua microtask).
const emitLocalChange = () => setTimeout(() => Dexie.ignoreTransaction(() => changeListeners.forEach((l) => l())), 0)

export function createDb(name: string): IdeosDB {
  const d = new Dexie(name) as IdeosDB

  d.version(1).stores({
    ideas: 'id, status, kind, createdAt, updatedAt, reviewedAt, *tags',
    attachments: 'id, ideaId, createdAt',
  })
  d.version(2)
    .stores({
      ideas: 'id, status, kind, createdAt, updatedAt, reviewedAt, *tags, dirty',
      attachments: 'id, ideaId, createdAt, dirty',
      tombstones: 'key, table',
      meta: 'key',
    })
    .upgrade(async (tx) => {
      // dữ liệu có từ trước khi bật đồng bộ: cần đẩy lên hết
      await tx.table('ideas').toCollection().modify({ dirty: 1 })
      await tx.table('attachments').toCollection().modify({ dirty: 1 })
    })

  // Ý tưởng cũ (hoặc từ máy chưa cập nhật) thiếu các mảng mới: điền mặc định ngay lúc đọc,
  // thay vì một lần nâng cấp DB vốn sẽ đánh dấu mọi ý tưởng là "vừa sửa" trên mọi máy.
  d.ideas.hook('reading', (obj) => {
    if (!obj) return obj
    delete (obj as SyncFlags)._remote // put() đè bản ghi có thể để sót cờ này
    return normalizeIdea(obj)
  })

  for (const table of [d.ideas, d.attachments] as unknown as Table<SyncFlags, string>[]) {
    const isIdeas = table.name === 'ideas'
    table.hook('creating', (_pk, obj: SyncFlags) => {
      if (obj._remote) {
        delete obj._remote
        obj.dirty = 0
      } else {
        obj.dirty = 1
        emitLocalChange()
      }
    })
    table.hook('updating', (mods) => {
      // so theo giá trị: bản ghi cũ có thể còn key _remote = undefined, put() sau đó sẽ báo key này "đổi"
      if ((mods as SyncFlags)._remote === true) return { _remote: undefined, dirty: 0 }
      emitLocalChange()
      // mọi thay đổi cục bộ đều phải tăng updatedAt để "bản mới hơn thắng" hoạt động đúng
      return isIdeas && !('updatedAt' in mods) ? { dirty: 1, updatedAt: Date.now() } : { dirty: 1 }
    })
  }
  d.tombstones.hook('creating', () => {
    emitLocalChange()
  })

  return d
}

export const db = createDb(IS_DEMO ? 'ideos-demo' : 'ideos')

if (IS_DEMO)
  db.on('ready', async () => {
    if (!(await db.ideas.count())) await db.ideas.bulkAdd(demoIdeas())
  })

/** Bỏ các trường nội bộ của đồng bộ khỏi bản ghi (dùng khi xuất/sao chép). */
export function stripSync<T extends object>(row: T): Omit<T, keyof SyncFlags> {
  const { dirty: _d, _remote: _r, ...rest } = row as T & SyncFlags
  return rest as Omit<T, keyof SyncFlags>
}

export function newIdea(partial: Partial<Idea> = {}): Idea {
  const now = Date.now()
  return {
    id: uid(),
    title: '',
    body: '',
    kind: 'other',
    status: 'spark',
    tags: [],
    pinned: false,
    scores: { impact: 0, confidence: 0, ease: 0 },
    canvas: emptyCanvas(),
    tasks: [],
    links: [],
    related: [],
    journal: [],
    assumptions: [],
    evidence: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

/** Ý tưởng tạo trước khi có nhật ký/giả định/bằng chứng (hoặc từ máy chưa cập nhật app) thiếu các mảng đó. */
export function normalizeIdea<T extends Partial<Idea>>(idea: T): T & Pick<Idea, 'journal' | 'assumptions' | 'evidence'> {
  return { ...idea, journal: idea.journal ?? [], assumptions: idea.assumptions ?? [], evidence: idea.evidence ?? [] }
}

const LIST_FIELDS = ['journal', 'assumptions', 'evidence', 'tasks'] as const

/**
 * Gộp hai phiên bản của cùng một ý tưởng khi cả hai máy cùng sửa lúc chưa đồng bộ:
 * các trường đơn lẻ lấy theo bản mới hơn, còn các danh sách (nhật ký, giả định, bằng chứng, việc)
 * lấy hợp theo id, để một dòng ghi thêm trên điện thoại không mất vì laptop vừa sửa tiêu đề.
 */
export function mergeIdeas(newer: Idea, older: Idea): Idea {
  const out: Idea = normalizeIdea({ ...newer })
  const o = normalizeIdea(older)
  for (const f of LIST_FIELDS) {
    const have = new Set((out[f] as { id: string }[]).map((x) => x.id))
    const extra = (o[f] as { id: string }[]).filter((x) => !have.has(x.id))
    if (extra.length) (out as unknown as Record<string, unknown[]>)[f] = [...(out[f] as unknown[]), ...extra]
  }
  out.journal = [...out.journal].sort((a, b) => a.at - b.at)
  out.related = [...new Set([...out.related, ...o.related])]
  return out
}

/** Thêm một dòng nhật ký vào ý tưởng. */
export async function addJournal(ideaId: string, text: string, kind: JournalEntry['kind'] = 'note', d: IdeosDB = db) {
  const t = text.trim()
  if (!t) return
  await d.transaction('rw', d.ideas, async () => {
    const idea = await d.ideas.get(ideaId)
    if (!idea) return
    await d.ideas.update(ideaId, { journal: [...(idea.journal ?? []), { id: uid(), at: Date.now(), kind, text: t }], updatedAt: Date.now() })
  })
}

/** `changes` nhận cả key path lồng nhau, ví dụ { 'scores.impact': 8 }. */
export async function updateIdea(id: string, changes: Partial<Idea> | Record<string, unknown>, d: IdeosDB = db) {
  await d.ideas.update(id, { ...changes, updatedAt: Date.now() } as Partial<Idea>)
}

/**
 * Sửa dựa trên bản mới nhất trong cơ sở dữ liệu, không phải bản đang hiện trên màn hình.
 * Dùng khi gõ liên tục vào ô số: hai lần sửa sát nhau không đè mất nhau.
 */
export async function patchIdea(id: string, fn: (idea: Idea) => Partial<Idea> | null, d: IdeosDB = db) {
  await d.transaction('rw', d.ideas, async () => {
    const idea = await d.ideas.get(id)
    const changes = idea && fn(idea)
    if (changes) await updateIdea(id, changes, d)
  })
}

const tomb = (table: Tombstone['table'], id: string, deletedAt = Date.now()): Tombstone => ({ key: `${table}:${id}`, table, id, deletedAt })

/** Xoá ý tưởng và trả về snapshot để có thể hoàn tác. */
export async function deleteIdea(id: string, d: IdeosDB = db) {
  return d.transaction('rw', [d.ideas, d.attachments, d.tombstones], async () => {
    const idea = await d.ideas.get(id)
    const atts = await d.attachments.where('ideaId').equals(id).toArray()
    await d.attachments.where('ideaId').equals(id).delete()
    await d.ideas.delete(id)
    await d.tombstones.bulkPut([tomb('ideas', id), ...atts.map((a) => tomb('attachments', a.id))])
    // gỡ liên kết từ các ý tưởng khác
    await d.ideas.filter((i) => i.related.includes(id)).modify((i) => {
      i.related = i.related.filter((r) => r !== id)
    })
    return { idea: idea && stripSync(idea), atts: atts.map(stripSync) }
  })
}

export async function restoreIdea(snapshot: { idea?: Idea; atts: Attachment[] }, d: IdeosDB = db) {
  if (!snapshot.idea) return
  await d.transaction('rw', [d.ideas, d.attachments, d.tombstones], async () => {
    await d.ideas.put({ ...snapshot.idea!, updatedAt: Date.now(), dirty: 1 })
    await d.attachments.bulkPut(snapshot.atts.map((a) => ({ ...a, dirty: 1 as const })))
    await d.tombstones.bulkDelete([`ideas:${snapshot.idea!.id}`, ...snapshot.atts.map((a) => `attachments:${a.id}`)])
  })
}

export async function removeAttachment(id: string, d: IdeosDB = db) {
  await d.transaction('rw', [d.attachments, d.tombstones], async () => {
    await d.attachments.delete(id)
    await d.tombstones.put(tomb('attachments', id))
  })
}

/** Xoá toàn bộ. `everywhere` = ghi bia mộ để xoá luôn trên các máy khác khi đồng bộ. */
export async function clearAll(everywhere: boolean, d: IdeosDB = db) {
  await d.transaction('rw', [d.ideas, d.attachments, d.tombstones, d.meta], async () => {
    if (everywhere) {
      const [ideaIds, attIds] = await Promise.all([d.ideas.toCollection().primaryKeys(), d.attachments.toCollection().primaryKeys()])
      await d.tombstones.bulkPut([...ideaIds.map((id) => tomb('ideas', id)), ...attIds.map((id) => tomb('attachments', id))])
    } else {
      await d.tombstones.clear()
      await d.meta.clear()
    }
    await d.ideas.clear()
    await d.attachments.clear()
  })
}

export async function linkIdeas(a: string, b: string, link: boolean, d: IdeosDB = db) {
  await d.transaction('rw', d.ideas, async () => {
    for (const [x, y] of [[a, b], [b, a]]) {
      const idea = await d.ideas.get(x)
      if (!idea) continue
      const set = new Set(idea.related)
      if (link) set.add(y)
      else set.delete(y)
      await d.ideas.update(x, { related: [...set] })
    }
  })
}
