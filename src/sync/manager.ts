import { useSyncExternalStore } from 'react'
import { clearAll, db, onLocalChange } from '../db'
import { IS_DEMO } from '../lib/demo'
import { checkServer, cloudflareRemote, createVault, deleteVault, SyncHttpError, vaultHead } from './cloudflare'
import { deriveKeys, formatCode, newSecret, parseCode, toBase64, fromBase64, type VaultKeys } from './crypto'
import { pendingCount, syncOnce } from './engine'

/**
 * unavailable: địa chỉ này không có máy chủ Ideos (vd. app deploy ở nơi khác, hoặc bản mẫu)
 * unpaired:    có máy chủ nhưng máy này chưa bật đồng bộ
 */
export type SyncStatus = 'checking' | 'unavailable' | 'unpaired' | 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncState {
  status: SyncStatus
  /** Mã đồng bộ đang dùng, dạng XXXX-XXXX-…; null khi chưa ghép */
  code: string | null
  lastSyncAt: number | null
  pending: number
  error: string | null
}

const SECRET_KEY = 'ideos.vault'
const LAST_KEY = 'ideos.lastSyncAt'
const POLL_MS = 20_000

function readSecret(): Uint8Array | null {
  try {
    const v = localStorage.getItem(SECRET_KEY)
    return v ? fromBase64(v) : null
  } catch {
    return null
  }
}

function writeSecret(secret: Uint8Array | null) {
  try {
    if (secret) localStorage.setItem(SECRET_KEY, toBase64(secret))
    else localStorage.removeItem(SECRET_KEY)
  } catch {
    /* chế độ riêng tư: mã chỉ sống trong phiên này */
  }
}

function readLast() {
  try {
    return Number(localStorage.getItem(LAST_KEY)) || null
  } catch {
    return null
  }
}

/* ---------- store ---------- */

let state: SyncState = { status: 'checking', code: null, lastSyncAt: readLast(), pending: 0, error: null }
const listeners = new Set<() => void>()
function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useSync() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

/* ---------- vòng đồng bộ ---------- */

let keys: VaultKeys | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let running = false
let again = false
let failures = 0
let lastHead = -1

const refreshPending = async () => set({ pending: await pendingCount(db) })

/** Khoá của kho đang ghép (cho các tính năng cần máy chủ, như AI); null khi chưa bật đồng bộ. */
export const currentKeys = () => keys

export function requestSync(delay = 0) {
  clearTimeout(timer)
  timer = setTimeout(runSync, delay)
}

/** Kho không còn (bị xoá từ máy khác) hoặc mã không còn hợp lệ: thử lại cũng vô ích. */
const isGone = (e: unknown) => e instanceof SyncHttpError && (e.status === 404 || e.status === 401)
export const GONE = 'Dữ liệu đồng bộ của mã này đã bị xoá trên máy chủ, có thể từ một máy khác. Ngắt đồng bộ ở đây rồi bật lại để tạo mã mới.'

const errorText = (e: unknown) =>
  isGone(e) ? GONE : e instanceof SyncHttpError ? e.message : e instanceof TypeError ? 'Không kết nối được máy chủ đồng bộ' : e instanceof Error ? e.message : String(e)

async function runSync() {
  if (!keys) return
  if (running) {
    again = true
    return
  }
  if (!navigator.onLine) {
    set({ status: 'offline' })
    return
  }
  running = true
  set({ status: 'syncing', error: null })
  try {
    await syncOnce(db, cloudflareRemote(keys))
    lastHead = await vaultHead(keys)
    failures = 0
    const now = Date.now()
    try {
      localStorage.setItem(LAST_KEY, String(now))
    } catch {
      /* bỏ qua */
    }
    set({ status: 'idle', lastSyncAt: now })
  } catch (e) {
    failures++
    set({ status: navigator.onLine ? 'error' : 'offline', error: errorText(e) })
    // thử lại lùi dần: 15s, 30s, 60s… tối đa 5 phút
    if (!isGone(e)) requestSync(Math.min(300_000, 15_000 * 2 ** (failures - 1)))
  } finally {
    running = false
    await refreshPending()
    if (again) {
      again = false
      requestSync(0)
    }
  }
}

/** Hỏi nhẹ máy chủ xem có gì mới (chỉ đọc một số), có thì mới đồng bộ. */
async function poll() {
  if (!keys || running || document.visibilityState !== 'visible' || !navigator.onLine || state.error === GONE) return
  try {
    const head = await vaultHead(keys)
    if (head !== lastHead || state.pending > 0) requestSync(0)
  } catch (e) {
    if (isGone(e)) set({ status: 'error', error: GONE })
  }
}

async function use(secret: Uint8Array) {
  keys = await deriveKeys(secret)
  lastHead = -1
  set({ code: formatCode(secret), status: 'idle', error: null })
}

let started = false

/** Khởi động đồng bộ. An toàn khi gọi nhiều lần. */
export async function initSync() {
  refreshPending()
  if (!started) {
    started = true
    onLocalChange(() => {
      refreshPending()
      requestSync(2000)
    })
    window.addEventListener('online', () => {
      if (keys) requestSync(0)
      else if (state.status === 'unavailable' || state.status === 'checking') probe()
    })
    window.addEventListener('offline', () => keys && set({ status: 'offline' }))
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && keys && requestSync(0))
    setInterval(poll, POLL_MS)
  }
  if (IS_DEMO) {
    set({ status: 'unavailable', code: null })
    return
  }
  const secret = readSecret()
  if (secret) {
    await use(secret)
    requestSync(0)
  } else await probe()
}

async function probe() {
  set({ status: 'checking' })
  if (!navigator.onLine) return // sự kiện 'online' sẽ gọi lại
  set({ status: (await checkServer()) ? 'unpaired' : 'unavailable' })
}

/* ---------- thao tác từ giao diện ---------- */

/** Bật đồng bộ lần đầu: tạo mã mới cho kho dữ liệu của bạn. */
export async function startNewVault() {
  const secret = newSecret()
  const k = await deriveKeys(secret)
  await createVault(k)
  writeSecret(secret)
  await use(secret)
  requestSync(0)
}

/** Ghép máy này vào kho đã có, bằng mã (hoặc link) từ máy khác. */
export async function joinVault(input: string) {
  const secret = parseCode(input)
  if (!secret) throw new Error('Mã chưa đúng. Mã gồm 26 ký tự, dạng XXXX-XXXX-…')
  const k = await deriveKeys(secret)
  try {
    await vaultHead(k)
  } catch (e) {
    if (e instanceof SyncHttpError && e.status === 404) throw new Error('Không có dữ liệu nào ứng với mã này. Kiểm tra lại từng ký tự.')
    throw e
  }
  writeSecret(secret)
  await use(secret)
  requestSync(0)
}

/**
 * Ngắt đồng bộ trên máy này.
 * wipeLocal: xoá ý tưởng trên máy này. wipeServer: xoá luôn kho trên máy chủ (mọi máy khác mất đồng bộ).
 */
export async function leaveVault({ wipeLocal, wipeServer }: { wipeLocal: boolean; wipeServer: boolean }) {
  if (!keys) return
  const gone = state.error === GONE
  if (!wipeLocal && !wipeServer && navigator.onLine && !gone) await runSync().catch(() => {})
  if (wipeServer && !gone) await deleteVault(keys)
  keys = null
  clearTimeout(timer)
  writeSecret(null)
  if (wipeLocal) await clearAll(false)
  else await db.meta.clear() // lần ghép sau sẽ gộp lại toàn bộ
  set({ code: null, error: null })
  await refreshPending()
  await probe()
}
