import Dexie, { type EntityTable, type Table } from 'dexie'
import type { Attachment, Idea } from './types'
import { emptyCanvas } from './types'
import { uid } from './lib/util'

/**
 * Đồng bộ: mọi bản ghi có cờ `dirty` (1 = có thay đổi chưa đẩy lên server).
 * Hook tự bật cờ cho mọi thao tác ghi, trừ khi bản ghi mang `_remote: true`
 * (dữ liệu vừa kéo về / vừa được server xác nhận) — khi đó cờ được tắt.
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
      if ('_remote' in mods) return { _remote: undefined, dirty: 0 }
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

export const db = createDb('ideos')

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
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

/** `changes` nhận cả key path lồng nhau, ví dụ { 'scores.impact': 8 }. */
export async function updateIdea(id: string, changes: Partial<Idea> | Record<string, unknown>, d: IdeosDB = db) {
  await d.ideas.update(id, { ...changes, updatedAt: Date.now() } as Partial<Idea>)
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
    await d.ideas.put({ ...snapshot.idea!, updatedAt: Date.now() })
    await d.attachments.bulkPut(snapshot.atts)
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
