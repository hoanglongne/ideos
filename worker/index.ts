/**
 * Máy chủ đồng bộ của Ideos: phục vụ app tĩnh và API /api/v1 trên D1.
 *
 * Máy chủ không biết mã đồng bộ. Máy khách gửi lên `vault` (một mã băm của mã đồng bộ)
 * và `token` (một mã băm khác); máy chủ chỉ lưu hash của token để kiểm tra quyền.
 * Nội dung ý tưởng và đính kèm đã được mã hoá AES-GCM trên máy trước khi gửi.
 */

import { briefText, CRITIQUE_PROMPT, extractJson, fakeCritique, fakeStructure, normCritique, normStructure, STRUCTURE_PROMPT, type IdeaBrief } from './ai-text'

interface Env {
  DB: D1Database
  ASSETS: Fetcher
  MAX_VAULTS?: string
  AI?: Ai
  AI_FAKE?: string
  AI_DAILY_LIMIT?: string
  AI_TEXT_MODEL?: string
  AI_ASR_MODEL?: string
}

const ROWS_PER_STATEMENT = 12 // D1 cho tối đa 100 tham số mỗi câu lệnh
const MAX_ROWS_PER_PUSH = 120
const MAX_DATA_CHARS = 1_000_000
const BLOB_PART = 1_000_000 // D1 giới hạn 2 MB mỗi dòng
const MAX_BLOB = 20_000_000
const PULL_LIMIT = 500

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } })

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const VAULT_RE = /^[0-9a-f]{32}$/
const ID_RE = /^[\w-]{1,100}$/

function bearer(req: Request) {
  const h = req.headers.get('Authorization') ?? ''
  const t = h.startsWith('Bearer ') ? h.slice(7) : ''
  if (t.length < 20 || t.length > 200) throw new HttpError(401, 'Thiếu mã truy cập')
  return t
}

/** Kiểm tra vault tồn tại và token đúng; trả về seq hiện tại. */
async function authorize(env: Env, vault: string, req: Request): Promise<number> {
  const token = bearer(req)
  const row = await env.DB.prepare('SELECT token_hash, seq FROM vaults WHERE id = ?').bind(vault).first<{ token_hash: string; seq: number }>()
  if (!row) throw new HttpError(404, 'Không có dữ liệu đồng bộ cho mã này')
  if (row.token_hash !== (await sha256Hex(token))) throw new HttpError(401, 'Mã đồng bộ không đúng')
  return row.seq
}

async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new HttpError(400, 'Dữ liệu gửi lên không hợp lệ')
  }
}

function chunk<T>(xs: T[], n: number) {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

interface IdeaIn {
  id: string
  data: string | null
  updatedAt: number
  deleted: boolean
}
interface AttIn {
  id: string
  meta: string | null
  deleted: boolean
}

function checkRows<T extends { id: string }>(rows: unknown): T[] {
  if (!Array.isArray(rows) || rows.length > MAX_ROWS_PER_PUSH) throw new HttpError(400, `Gửi tối đa ${MAX_ROWS_PER_PUSH} dòng mỗi lần`)
  for (const r of rows as T[]) if (!r || typeof r.id !== 'string' || !ID_RE.test(r.id)) throw new HttpError(400, 'id không hợp lệ')
  return rows as T[]
}

/**
 * Ghi nhiều dòng trong một transaction (D1 batch). Mỗi nhóm dành trước một khoảng seq
 * rồi ghi luôn trong cùng transaction, nên seq tăng theo đúng thứ tự commit
 * và máy kéo về theo con trỏ seq không bao giờ bỏ sót dòng nào.
 */
function seqStatements(env: Env, vault: string, rows: unknown[][], sql: (values: string) => string, cols: number) {
  const stmts: D1PreparedStatement[] = []
  for (const group of chunk(rows, ROWS_PER_STATEMENT)) {
    const n = group.length
    stmts.push(env.DB.prepare('UPDATE vaults SET seq = seq + ? WHERE id = ?').bind(n, vault))
    const values = group.map((_, i) => `(${Array(cols).fill('?').join(', ')}, (SELECT seq FROM vaults WHERE id = ?) - ${n - 1 - i})`).join(', ')
    stmts.push(env.DB.prepare(sql(values)).bind(...group.flatMap((r) => [...r, vault])))
  }
  return stmts
}

async function pushIdeas(env: Env, vault: string, req: Request) {
  const rows = checkRows<IdeaIn>((await readJson<{ rows: unknown }>(req)).rows)
  for (const r of rows) {
    if (!Number.isSafeInteger(r.updatedAt)) throw new HttpError(400, 'updatedAt không hợp lệ')
    if (r.data !== null && (typeof r.data !== 'string' || r.data.length > MAX_DATA_CHARS)) throw new HttpError(400, 'Ý tưởng quá lớn')
  }
  if (!rows.length) return json({ ok: true })
  // Bản mới hơn thắng: chỉ ghi đè khi updatedAt gửi lên >= bản đang có
  const stmts = seqStatements(
    env,
    vault,
    rows.map((r) => [vault, r.id, r.deleted ? null : r.data, r.updatedAt, r.deleted ? 1 : 0]),
    (values) =>
      `INSERT INTO ideas (vault, id, data, updated_at, deleted, seq) VALUES ${values}
       ON CONFLICT (vault, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted, seq = excluded.seq
       WHERE excluded.updated_at >= ideas.updated_at`,
    5,
  )
  await env.DB.batch(stmts)
  return json({ ok: true })
}

async function pushAttachments(env: Env, vault: string, req: Request) {
  const rows = checkRows<AttIn>((await readJson<{ rows: unknown }>(req)).rows)
  for (const r of rows) if (r.meta !== null && (typeof r.meta !== 'string' || r.meta.length > 10_000)) throw new HttpError(400, 'meta không hợp lệ')
  if (!rows.length) return json({ ok: true })
  const stmts = seqStatements(
    env,
    vault,
    rows.map((r) => [vault, r.id, r.deleted ? null : r.meta, r.deleted ? 1 : 0]),
    (values) =>
      `INSERT INTO attachments (vault, id, meta, deleted, seq) VALUES ${values}
       ON CONFLICT (vault, id) DO UPDATE SET meta = excluded.meta, deleted = excluded.deleted, seq = excluded.seq`,
    4,
  )
  await env.DB.batch(stmts)
  return json({ ok: true })
}

function pullParams(url: URL) {
  const after = Number(url.searchParams.get('after') ?? 0)
  if (!Number.isSafeInteger(after) || after < 0) throw new HttpError(400, 'after không hợp lệ')
  const limit = Math.min(PULL_LIMIT, Math.max(1, Number(url.searchParams.get('limit') ?? PULL_LIMIT) || PULL_LIMIT))
  return { after, limit }
}

async function pullIdeas(env: Env, vault: string, url: URL) {
  const { after, limit } = pullParams(url)
  const { results } = await env.DB.prepare('SELECT id, data, updated_at, deleted, seq FROM ideas WHERE vault = ? AND seq > ? ORDER BY seq LIMIT ?')
    .bind(vault, after, limit)
    .all<{ id: string; data: string | null; updated_at: number; deleted: number; seq: number }>()
  return json({ rows: results.map((r) => ({ id: r.id, data: r.data, updatedAt: r.updated_at, deleted: !!r.deleted, seq: r.seq })) })
}

async function pullAttachments(env: Env, vault: string, url: URL) {
  const { after, limit } = pullParams(url)
  const { results } = await env.DB.prepare('SELECT id, meta, deleted, seq FROM attachments WHERE vault = ? AND seq > ? ORDER BY seq LIMIT ?')
    .bind(vault, after, limit)
    .all<{ id: string; meta: string | null; deleted: number; seq: number }>()
  return json({ rows: results.map((r) => ({ id: r.id, meta: r.meta, deleted: !!r.deleted, seq: r.seq })) })
}

async function putBlob(env: Env, vault: string, id: string, req: Request) {
  const buf = new Uint8Array(await req.arrayBuffer())
  if (!buf.length || buf.length > MAX_BLOB) throw new HttpError(413, 'File quá lớn (tối đa 20 MB)')
  const stmts = [env.DB.prepare('DELETE FROM blobs WHERE vault = ? AND id = ?').bind(vault, id)]
  for (let part = 0, off = 0; off < buf.length; part++, off += BLOB_PART)
    stmts.push(env.DB.prepare('INSERT INTO blobs (vault, id, part, data) VALUES (?, ?, ?, ?)').bind(vault, id, part, buf.slice(off, off + BLOB_PART)))
  await env.DB.batch(stmts)
  return json({ ok: true })
}

async function getBlob(env: Env, vault: string, id: string) {
  const { results } = await env.DB.prepare('SELECT data FROM blobs WHERE vault = ? AND id = ? ORDER BY part').bind(vault, id).all<{ data: ArrayBuffer | number[] }>()
  if (!results.length) throw new HttpError(404, 'Không tìm thấy file')
  const parts = results.map((r) => (r.data instanceof ArrayBuffer ? new Uint8Array(r.data) : Uint8Array.from(r.data)))
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return new Response(out, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', ...CORS } })
}

async function deleteBlobs(env: Env, vault: string, req: Request) {
  const { ids } = await readJson<{ ids: unknown }>(req)
  if (!Array.isArray(ids) || ids.length > MAX_ROWS_PER_PUSH || !ids.every((x) => typeof x === 'string' && ID_RE.test(x))) throw new HttpError(400, 'ids không hợp lệ')
  if (ids.length) await env.DB.batch(chunk(ids, 90).map((g) => env.DB.prepare(`DELETE FROM blobs WHERE vault = ? AND id IN (${g.map(() => '?').join(',')})`).bind(vault, ...g)))
  return json({ ok: true })
}

async function createVault(env: Env, vault: string, req: Request) {
  const token = bearer(req)
  const hash = await sha256Hex(token)
  const existing = await env.DB.prepare('SELECT token_hash FROM vaults WHERE id = ?').bind(vault).first<{ token_hash: string }>()
  if (existing) {
    if (existing.token_hash !== hash) throw new HttpError(409, 'Mã này đã được dùng')
    return json({ ok: true, created: false })
  }
  const max = Number(env.MAX_VAULTS ?? 3) || 3
  const count = (await env.DB.prepare('SELECT COUNT(*) AS n FROM vaults').first<{ n: number }>())?.n ?? 0
  if (count >= max) throw new HttpError(403, `Máy chủ này đã đủ ${max} mã đồng bộ. Tăng MAX_VAULTS trong wrangler.jsonc nếu cần thêm.`)
  await env.DB.prepare('INSERT INTO vaults (id, token_hash, seq, created_at) VALUES (?, ?, 0, ?)').bind(vault, hash, Date.now()).run()
  return json({ ok: true, created: true }, 201)
}

async function deleteVault(env: Env, vault: string) {
  await env.DB.batch(
    ['blobs', 'attachments', 'ideas', 'ai_usage'].map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE vault = ?`).bind(vault)).concat(env.DB.prepare('DELETE FROM vaults WHERE id = ?').bind(vault)),
  )
  return json({ ok: true })
}

/* ---------- AI (Workers AI) ---------- */

const DEFAULT_TEXT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const DEFAULT_ASR_MODEL = '@cf/openai/whisper-large-v3-turbo'
// Gói Workers free chỉ cho 10 ms CPU mỗi request; chuyển base64 vài MB đã sát mức đó.
// 2 MB ghi âm thoại (opus) là khoảng 10 phút nói, quá đủ cho một ý tưởng.
const MAX_AUDIO = 2_000_000

const aiEnabled = (env: Env) => !!env.AI || env.AI_FAKE === '1'
const aiLimit = (env: Env) => Number(env.AI_DAILY_LIMIT ?? 30) || 30
const today = () => new Date().toISOString().slice(0, 10)

async function aiUsed(env: Env, vault: string) {
  return (await env.DB.prepare('SELECT n FROM ai_usage WHERE vault = ? AND day = ?').bind(vault, today()).first<{ n: number }>())?.n ?? 0
}

/** Trừ một lượt trước khi gọi AI; AI lỗi thì trả lại lượt. */
async function withQuota<T>(env: Env, vault: string, fn: () => Promise<T>): Promise<T> {
  if (!aiEnabled(env)) throw new HttpError(501, 'Máy chủ này chưa bật AI')
  const day = today()
  const row = await env.DB.prepare('INSERT INTO ai_usage (vault, day, n) VALUES (?, ?, 1) ON CONFLICT (vault, day) DO UPDATE SET n = n + 1 RETURNING n')
    .bind(vault, day)
    .first<{ n: number }>()
  const refund = () => env.DB.prepare('UPDATE ai_usage SET n = n - 1 WHERE vault = ? AND day = ?').bind(vault, day).run()
  if ((row?.n ?? 0) > aiLimit(env)) {
    await refund()
    throw new HttpError(429, `Hôm nay đã dùng hết ${aiLimit(env)} lượt AI. Hạn mức mới bắt đầu lúc 7 giờ sáng.`)
  }
  try {
    return await fn()
  } catch (e) {
    await refund()
    if (e instanceof HttpError) throw e
    console.error('AI lỗi', e)
    throw new HttpError(502, 'AI đang trục trặc, thử lại sau ít phút. Lượt này không bị tính.')
  }
}

/** Gọi model chữ và lấy về object JSON. Thử chế độ JSON trước; model không hỗ trợ thì gọi thường rồi tự tách. */
async function runJson(env: Env, system: string, user: string): Promise<Record<string, unknown>> {
  const model = (env.AI_TEXT_MODEL || DEFAULT_TEXT_MODEL) as Parameters<Ai['run']>[0]
  const base = { messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: 1000, temperature: 0.3 }
  let out: unknown
  try {
    out = await env.AI!.run(model, { ...base, response_format: { type: 'json_object' } } as never)
  } catch {
    out = await env.AI!.run(model, base as never)
  }
  const r = (out as { response?: unknown })?.response
  if (r && typeof r === 'object') return r as Record<string, unknown>
  return extractJson(String(r ?? ''))
}

async function aiStatus(env: Env, vault: string) {
  const used = aiEnabled(env) ? await aiUsed(env, vault) : 0
  return json({ enabled: aiEnabled(env), fake: env.AI_FAKE === '1', limit: aiLimit(env), used })
}

async function aiTranscribe(env: Env, vault: string, req: Request) {
  const buf = new Uint8Array(await req.arrayBuffer())
  if (!buf.length) throw new HttpError(400, 'Không có âm thanh')
  if (buf.length > MAX_AUDIO) throw new HttpError(413, 'Đoạn ghi âm quá dài để chép lời (tối đa khoảng 10 phút)')
  const text = await withQuota(env, vault, async () => {
    if (env.AI_FAKE === '1') return `(AI giả khi chạy trên máy) Bản chép lời mẫu cho đoạn ghi âm ${Math.round(buf.length / 1024)} KB: ý tưởng app tìm bạn chạy bộ quanh hồ, ghép theo pace và giờ chạy.`
    const model = (env.AI_ASR_MODEL || DEFAULT_ASR_MODEL) as Parameters<Ai['run']>[0]
    // whisper-large-v3-turbo nhận base64; whisper đời cũ nhận mảng byte
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    const input = /turbo|large/.test(String(model)) ? { audio: btoa(bin), language: 'vi' } : { audio: [...buf] }
    const out = (await env.AI!.run(model, input as never)) as { text?: string }
    return (out?.text ?? '').trim()
  })
  if (!text) throw new HttpError(422, 'Không nghe ra lời nào trong đoạn ghi âm')
  return json({ text })
}

async function aiStructure(env: Env, vault: string, req: Request) {
  const { text } = await readJson<{ text?: unknown }>(req)
  if (typeof text !== 'string' || !text.trim()) throw new HttpError(400, 'Thiếu nội dung')
  const result = await withQuota(env, vault, async () => (env.AI_FAKE === '1' ? fakeStructure(text) : normStructure(await runJson(env, STRUCTURE_PROMPT, text.slice(0, 6000)))))
  return json(result)
}

async function aiCritique(env: Env, vault: string, req: Request) {
  const { idea } = await readJson<{ idea?: IdeaBrief }>(req)
  if (!idea || typeof idea.title !== 'string') throw new HttpError(400, 'Thiếu ý tưởng')
  const result = await withQuota(env, vault, async () => (env.AI_FAKE === '1' ? fakeCritique(idea) : normCritique(await runJson(env, CRITIQUE_PROMPT, briefText(idea)))))
  if (!result.weaknesses.length && !result.assumptions.length) throw new HttpError(502, 'AI không đưa ra được phản biện nào, thử lại sau.')
  return json(result)
}

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const parts = url.pathname.split('/').filter(Boolean) // api, v1, ...
  if (parts[1] !== 'v1') throw new HttpError(404, 'Không có API này')
  if (parts[2] === 'health' && req.method === 'GET') return json({ ok: true, app: 'ideos', api: 1 })
  if (parts[2] !== 'vaults' || !parts[3] || !VAULT_RE.test(parts[3])) throw new HttpError(404, 'Không có API này')
  const vault = parts[3]
  const rest = parts.slice(4).join('/')
  const m = req.method

  if (!rest && m === 'POST') return createVault(env, vault, req)
  const seq = await authorize(env, vault, req)
  if (!rest && m === 'GET') return json({ seq })
  if (!rest && m === 'DELETE') return deleteVault(env, vault)
  if (rest === 'ideas' && m === 'POST') return pushIdeas(env, vault, req)
  if (rest === 'ideas' && m === 'GET') return pullIdeas(env, vault, url)
  if (rest === 'attachments' && m === 'POST') return pushAttachments(env, vault, req)
  if (rest === 'attachments' && m === 'GET') return pullAttachments(env, vault, url)
  if (rest === 'blobs/delete' && m === 'POST') return deleteBlobs(env, vault, req)
  if (rest === 'ai' && m === 'GET') return aiStatus(env, vault)
  if (rest === 'ai/transcribe' && m === 'POST') return aiTranscribe(env, vault, req)
  if (rest === 'ai/structure' && m === 'POST') return aiStructure(env, vault, req)
  if (rest === 'ai/critique' && m === 'POST') return aiCritique(env, vault, req)
  const blob = rest.match(/^blobs\/([\w-]{1,100})$/)
  if (blob && m === 'PUT') return putBlob(env, vault, blob[1], req)
  if (blob && m === 'GET') return getBlob(env, vault, blob[1])
  throw new HttpError(404, 'Không có API này')
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)
    try {
      return await api(req, env, url)
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status)
      console.error(e)
      return json({ error: 'Lỗi máy chủ' }, 500)
    }
  },
} satisfies ExportedHandler<Env>
