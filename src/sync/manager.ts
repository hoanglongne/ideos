import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { clearAll, db, onLocalChange } from '../db'
import { pendingCount, syncOnce } from './engine'
import { supabaseRemote } from './supabase'

export type SyncStatus = 'disabled' | 'signed-out' | 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncState {
  status: SyncStatus
  configFromEnv: boolean
  url: string
  email: string | null
  lastSyncAt: number | null
  pending: number
  error: string | null
}

const CONFIG_KEY = 'ideos.supabase'
const LAST_KEY = 'ideos.lastSyncAt'
const ENV_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

function readConfig(): { url: string; key: string } | null {
  if (ENV_URL && ENV_KEY) return { url: ENV_URL, key: ENV_KEY }
  try {
    const c = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null')
    return c?.url && c?.key ? c : null
  } catch {
    return null
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

let state: SyncState = {
  status: 'disabled',
  configFromEnv: !!(ENV_URL && ENV_KEY),
  url: readConfig()?.url ?? '',
  email: null,
  lastSyncAt: readLast(),
  pending: 0,
  error: null,
}
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

let client: SupabaseClient | null = null
let userId: string | null = null
let channel: RealtimeChannel | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let running = false
let again = false
let failures = 0

const refreshPending = async () => set({ pending: await pendingCount(db) })

export function requestSync(delay = 0) {
  clearTimeout(timer)
  timer = setTimeout(runSync, delay)
}

async function runSync() {
  if (!client || !userId) return
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
    await syncOnce(db, supabaseRemote(client, userId))
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
    set({ status: navigator.onLine ? 'error' : 'offline', error: e instanceof Error ? e.message : String(e) })
    // thử lại lùi dần: 15s, 30s, 60s… tối đa 5 phút
    requestSync(Math.min(300_000, 15_000 * 2 ** (failures - 1)))
  } finally {
    running = false
    await refreshPending()
    if (again) {
      again = false
      requestSync(0)
    }
  }
}

function subscribeRealtime() {
  if (!client || !userId) return
  channel = client.channel('ideos-' + userId)
  for (const table of ['ideas', 'attachments'])
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` }, () => requestSync(800))
  channel.subscribe()
}

async function setUser(id: string | null, email: string | null) {
  if (id === userId) return
  if (channel) {
    await client?.removeChannel(channel)
    channel = null
  }
  userId = id
  set({ email, status: id ? 'idle' : 'signed-out' })
  if (id) {
    subscribeRealtime()
    requestSync(0)
  }
}

let started = false

/** Khởi động đồng bộ nếu đã cấu hình Supabase. An toàn khi gọi nhiều lần. */
export async function initSync() {
  refreshPending()
  if (!started) {
    started = true
    onLocalChange(() => {
      refreshPending()
      requestSync(2000)
    })
    window.addEventListener('online', () => requestSync(0))
    window.addEventListener('offline', () => state.status !== 'disabled' && state.status !== 'signed-out' && set({ status: 'offline' }))
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && requestSync(0))
    setInterval(() => document.visibilityState === 'visible' && requestSync(0), 5 * 60_000)
  }

  const cfg = readConfig()
  if (!cfg) {
    set({ status: 'disabled' })
    return
  }
  const { createClient } = await import('@supabase/supabase-js')
  client = createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'ideos.auth' },
  })
  set({ url: cfg.url, status: 'signed-out' })
  client.auth.onAuthStateChange((_event, session) => {
    // tránh gọi API Supabase ngay trong callback (khuyến nghị của supabase-js)
    setTimeout(() => setUser(session?.user.id ?? null, session?.user.email ?? null), 0)
  })
  const { data } = await client.auth.getSession()
  await setUser(data.session?.user.id ?? null, data.session?.user.email ?? null)
}

/* ---------- thao tác từ giao diện ---------- */

export async function saveConfig(url: string, key: string) {
  url = url.trim().replace(/\/+$/, '')
  // http chỉ cho localhost (Supabase chạy local bằng `supabase start`)
  if (!/^(https:\/\/.+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(url)) throw new Error('URL phải bắt đầu bằng https://')
  if (!key.trim()) throw new Error('Thiếu API key')
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, key: key.trim() }))
  await disconnect()
  await initSync()
}

async function disconnect() {
  if (channel) await client?.removeChannel(channel)
  channel = null
  userId = null
  client = null
}

export async function forgetConfig() {
  await client?.auth.signOut().catch(() => {})
  await disconnect()
  localStorage.removeItem(CONFIG_KEY)
  set({ status: 'disabled', email: null, url: '' })
}

export async function signIn(email: string, password: string) {
  if (!client) throw new Error('Chưa cấu hình Supabase')
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Sai email hoặc mật khẩu' : error.message)
}

/** Trả về true nếu cần xác nhận email trước khi đăng nhập. */
export async function signUp(email: string, password: string): Promise<boolean> {
  if (!client) throw new Error('Chưa cấu hình Supabase')
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: location.origin + location.pathname },
  })
  if (error) throw new Error(error.message)
  return !data.session
}

export async function signOut(wipeLocal: boolean) {
  if (!client) return
  // đẩy nốt thay đổi trước khi thoát
  if (!wipeLocal && navigator.onLine) await runSync().catch(() => {})
  await client.auth.signOut()
  await setUser(null, null)
  if (wipeLocal) await clearAll(false)
  await refreshPending()
}
