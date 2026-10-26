import type { AttachmentType, Idea } from '../types'
import { decryptBytes, decryptJson, encryptBytes, encryptJson, type VaultKeys } from './crypto'
import type { RemoteAttachment, RemoteIdea, SyncRemote } from './engine'

/** Lỗi từ máy chủ đồng bộ, kèm mã HTTP để giao diện nói đúng chuyện gì xảy ra. */
export class SyncHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

const PUSH_BATCH = 100
const PULL_LIMIT = 500

interface AttMeta {
  ideaId: string
  type: AttachmentType
  mime: string
  duration: number | null
  createdAt: number
}

/** Gốc của API: cùng địa chỉ với app (deploy trên Cloudflare), hoặc VITE_SYNC_URL nếu app nằm chỗ khác. */
export const API_BASE = ((import.meta.env.VITE_SYNC_URL as string | undefined) || '').replace(/\/+$/, '') + '/api/v1'

export async function call(path: string, init: RequestInit & { token?: string } = {}) {
  const { token, ...rest } = init
  const res = await fetch(API_BASE + path, {
    ...rest,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(rest.body && typeof rest.body === 'string' ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
    cache: 'no-store',
  })
  if (!res.ok) {
    let msg = `Máy chủ trả lỗi ${res.status}`
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg
    } catch {
      /* không phải JSON */
    }
    throw new SyncHttpError(res.status, msg)
  }
  return res
}

/** Máy chủ đồng bộ có chạy ở địa chỉ này không. */
export async function checkServer(timeoutMs = 6000): Promise<boolean> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(API_BASE + '/health', { signal: ctl.signal, cache: 'no-store' })
    if (!res.ok) return false
    return ((await res.json()) as { app?: string }).app === 'ideos'
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

export const createVault = (k: VaultKeys) => call(`/vaults/${k.vault}`, { method: 'POST', token: k.token })

/** seq mới nhất của kho; dùng để biết máy khác vừa ghi gì chưa mà không phải kéo cả dữ liệu. */
export async function vaultHead(k: VaultKeys): Promise<number> {
  return ((await (await call(`/vaults/${k.vault}`, { token: k.token })).json()) as { seq: number }).seq
}

export const deleteVault = (k: VaultKeys) => call(`/vaults/${k.vault}`, { method: 'DELETE', token: k.token })

async function pullAll<T extends { seq: number }>(k: VaultKeys, kind: string, after: number): Promise<T[]> {
  const out: T[] = []
  for (let cursor = after; ; ) {
    const { rows } = (await (await call(`/vaults/${k.vault}/${kind}?after=${cursor}&limit=${PULL_LIMIT}`, { token: k.token })).json()) as { rows: T[] }
    out.push(...rows)
    if (rows.length < PULL_LIMIT) return out
    cursor = rows[rows.length - 1].seq
  }
}

async function pushAll(k: VaultKeys, kind: string, rows: unknown[]) {
  for (let i = 0; i < rows.length; i += PUSH_BATCH)
    await call(`/vaults/${k.vault}/${kind}`, { method: 'POST', token: k.token, body: JSON.stringify({ rows: rows.slice(i, i + PUSH_BATCH) }) })
}

export function cloudflareRemote(k: VaultKeys): SyncRemote {
  return {
    scope: k.vault,
    async pushIdeas(rows) {
      const enc = await Promise.all(rows.map(async (r) => ({ id: r.id, data: r.data && !r.deleted ? await encryptJson(k.key, r.data) : null, updatedAt: r.updatedAt, deleted: r.deleted })))
      await pushAll(k, 'ideas', enc)
    },
    async pullIdeas(after) {
      const rows = await pullAll<{ id: string; data: string | null; updatedAt: number; deleted: boolean; seq: number }>(k, 'ideas', after)
      return Promise.all(
        rows.map(async (r): Promise<RemoteIdea> => ({ id: r.id, updatedAt: r.updatedAt, deleted: r.deleted, seq: r.seq, data: r.data ? await decryptJson<Idea>(k.key, r.data) : null })),
      )
    },
    async pushAttachments(rows) {
      const enc = await Promise.all(
        rows.map(async (r) => ({
          id: r.id,
          deleted: r.deleted,
          meta: r.deleted ? null : await encryptJson(k.key, { ideaId: r.ideaId, type: r.type, mime: r.mime, duration: r.duration, createdAt: r.createdAt } satisfies AttMeta),
        })),
      )
      await pushAll(k, 'attachments', enc)
    },
    async pullAttachments(after) {
      const rows = await pullAll<{ id: string; meta: string | null; deleted: boolean; seq: number }>(k, 'attachments', after)
      return Promise.all(
        rows.map(async (r): Promise<RemoteAttachment> => {
          const m = r.meta ? await decryptJson<AttMeta>(k.key, r.meta) : null
          return { id: r.id, deleted: r.deleted || !m, seq: r.seq, ideaId: m?.ideaId ?? '', type: m?.type ?? 'image', mime: m?.mime ?? '', duration: m?.duration ?? null, createdAt: m?.createdAt ?? 0 }
        }),
      )
    },
    async uploadBlob(id, blob) {
      const body = await encryptBytes(k.key, await blob.arrayBuffer())
      await call(`/vaults/${k.vault}/blobs/${id}`, { method: 'PUT', token: k.token, body: body as BodyInit, headers: { 'Content-Type': 'application/octet-stream' } })
    },
    async downloadBlob(id) {
      const res = await call(`/vaults/${k.vault}/blobs/${id}`, { token: k.token })
      return new Blob([await decryptBytes(k.key, await res.arrayBuffer())])
    },
    async deleteBlobs(ids) {
      for (let i = 0; i < ids.length; i += PUSH_BATCH)
        await call(`/vaults/${k.vault}/blobs/delete`, { method: 'POST', token: k.token, body: JSON.stringify({ ids: ids.slice(i, i + PUSH_BATCH) }) })
    },
  }
}
