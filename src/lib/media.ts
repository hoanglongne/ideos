import { useCallback, useEffect, useRef, useState } from 'react'
import type { GeoStamp } from '../types'

/* ---------- Ghi âm (chạy offline, lưu thành file audio) ---------- */

export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const startedAt = useRef(0)
  const resolver = useRef<((r: { blob: Blob; duration: number } | null) => void) | null>(null)

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setElapsed((Date.now() - startedAt.current) / 1000), 250)
    return () => clearInterval(t)
  }, [recording])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find(
        (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
      )
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
        const duration = (Date.now() - startedAt.current) / 1000
        resolver.current?.(blob.size ? { blob, duration } : null)
        resolver.current = null
      }
      startedAt.current = Date.now()
      setElapsed(0)
      rec.start(500)
      recRef.current = rec
      setRecording(true)
    } catch (e) {
      setError(e instanceof Error && e.name === 'NotAllowedError' ? 'Chưa cấp quyền micro' : 'Không ghi âm được trên thiết bị này')
    }
  }, [])

  const stop = useCallback(
    () =>
      new Promise<{ blob: Blob; duration: number } | null>((res) => {
        const rec = recRef.current
        if (!rec || rec.state === 'inactive') return res(null)
        resolver.current = res
        rec.stop()
        recRef.current = null
        setRecording(false)
      }),
    [],
  )

  useEffect(() => () => recRef.current?.stop(), [])

  return { recording, elapsed, error, start, stop, supported: typeof MediaRecorder !== 'undefined' }
}

/* ---------- Đọc chính tả (Web Speech API — đa số trình duyệt cần mạng) ---------- */

type AnyRecognition = any

const SpeechRecognitionCtor: (new () => AnyRecognition) | undefined =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : undefined

export function useDictation(lang: string, onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<AnyRecognition>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    if (!SpeechRecognitionCtor) return
    setError(null)
    const rec = new SpeechRecognitionCtor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e: AnyRecognition) => {
      let partial = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) onTextRef.current(r[0].transcript.trim())
        else partial += r[0].transcript
      }
      setInterim(partial)
    }
    rec.onerror = (e: AnyRecognition) => {
      setError(e.error === 'network' ? 'Đọc chính tả cần mạng — hãy dùng Ghi âm khi offline' : e.error === 'not-allowed' ? 'Chưa cấp quyền micro' : 'Lỗi nhận giọng nói')
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
    }
    rec.start()
    recRef.current = rec
    setListening(true)
  }, [lang])

  useEffect(() => () => recRef.current?.abort?.(), [])

  return { supported: !!SpeechRecognitionCtor, listening, interim, error, start, stop }
}

/* ---------- Vị trí ---------- */

export function getLocation(timeout = 6000): Promise<GeoStamp | undefined> {
  return new Promise((res) => {
    if (!('geolocation' in navigator)) return res(undefined)
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      () => res(undefined),
      { enableHighAccuracy: false, timeout, maximumAge: 5 * 60_000 },
    )
  })
}

/* ---------- Online/offline ---------- */

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function useObjectUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
