import { useCallback, useEffect, useState } from 'react'
import type { Idea } from '../types'
import { CANVAS_FIELDS } from '../types'
import { call, SyncHttpError } from './cloudflare'
import { useSettings } from '../lib/settings'
import { currentKeys, useSync } from './manager'

/**
 * AI chạy trên Worker của bạn (Workers AI). Chỉ dùng được khi đã bật đồng bộ: máy chủ cần mã đồng bộ
 * để biết yêu cầu đến từ bạn, và đếm hạn mức mỗi ngày theo mã đó.
 * Khác với dữ liệu đồng bộ, nội dung gửi cho AI không được mã hoá đầu cuối (AI phải đọc được chữ).
 */

export interface AiStatus {
  enabled: boolean
  fake: boolean
  limit: number
  used: number
}

export interface Structured {
  title: string
  body: string
  problem: string
  audience: string
  kind: Idea['kind']
  tags: string[]
}

export interface Critique {
  weaknesses: string[]
  assumptions: { text: string; risk: 1 | 2 | 3 }[]
  questions: string[]
}

function keysOrThrow() {
  const k = currentKeys()
  if (!k) throw new Error('Bật đồng bộ trong Cài đặt để dùng AI')
  return k
}

const errorText = (e: unknown) => (e instanceof SyncHttpError || e instanceof Error ? e.message : String(e))

export async function aiStatus(): Promise<AiStatus> {
  const k = keysOrThrow()
  return (await (await call(`/vaults/${k.vault}/ai`, { token: k.token })).json()) as AiStatus
}

export async function transcribe(audio: Blob): Promise<string> {
  const k = keysOrThrow()
  const res = await call(`/vaults/${k.vault}/ai/transcribe`, { method: 'POST', token: k.token, body: audio, headers: { 'Content-Type': audio.type || 'application/octet-stream' } })
  return ((await res.json()) as { text: string }).text
}

export async function structure(text: string): Promise<Structured> {
  const k = keysOrThrow()
  return (await (await call(`/vaults/${k.vault}/ai/structure`, { method: 'POST', token: k.token, body: JSON.stringify({ text }) })).json()) as Structured
}

export async function critique(idea: Idea): Promise<Critique> {
  const k = keysOrThrow()
  const brief = briefOf(idea)
  return (await (await call(`/vaults/${k.vault}/ai/critique`, { method: 'POST', token: k.token, body: JSON.stringify({ idea: brief }) })).json()) as Critique
}

function briefOf(idea: Idea) {
  return {
    title: idea.title,
    body: idea.body,
    canvas: Object.fromEntries(CANVAS_FIELDS.map((f) => [f.label, idea.canvas[f.key]])),
    assumptions: idea.assumptions.map((a) => a.text),
    evidence: idea.evidence.map((e) => ({ text: e.text, signal: e.signal === 'for' ? 'ủng hộ' : e.signal === 'against' ? 'phản bác' : 'chưa rõ' })),
    journal: idea.journal.filter((j) => j.kind === 'note' || j.kind === 'coach').map((j) => j.text),
  }
}

/** Câu hỏi tiếp theo câu trả lời vừa rồi, hoặc null khi câu trả lời đã đủ cụ thể. */
export async function followup(idea: Idea, question: string, answer: string): Promise<string | null> {
  const k = keysOrThrow()
  const res = await call(`/vaults/${k.vault}/ai/followup`, { method: 'POST', token: k.token, body: JSON.stringify({ idea: briefOf(idea), question, answer }) })
  return ((await res.json()) as { question: string | null }).question
}

export type AiAvailability = { state: 'loading' } | { state: 'disabled' } | { state: 'unpaired' } | { state: 'off' } | { state: 'error'; message: string } | { state: 'ready'; status: AiStatus }

/** Trạng thái AI cho giao diện: chưa bật đồng bộ / máy chủ chưa bật AI / sẵn sàng (kèm số lượt còn lại). */
export function useAi() {
  const sync = useSync()
  const { ai } = useSettings()
  const [avail, setAvail] = useState<AiAvailability>({ state: 'loading' })
  const refresh = useCallback(async () => {
    // người dùng tắt AI: không gọi gì lên máy chủ, kể cả hỏi trạng thái
    if (!ai) return setAvail({ state: 'disabled' })
    if (!sync.code) return setAvail({ state: 'unpaired' })
    try {
      const status = await aiStatus()
      setAvail(status.enabled ? { state: 'ready', status } : { state: 'off' })
    } catch (e) {
      setAvail({ state: 'error', message: errorText(e) })
    }
  }, [sync.code, ai])
  useEffect(() => {
    refresh()
  }, [refresh])
  return { avail, refresh }
}

export { errorText as aiErrorText }
