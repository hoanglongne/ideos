import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { CaptureSheet } from './components/CaptureSheet'
import { IdeaDetail } from './components/IdeaDetail'
import { IdeaList } from './components/IdeaList'
import { Review } from './components/Review'
import { Settings, type InstallPromptEvent } from './components/Settings'
import { Stats } from './components/Stats'
import { db } from './db'
import { useOnline } from './lib/media'
import { go, useRoute } from './lib/router'
import { useSettings } from './lib/settings'
import { syncLabel } from './components/SyncPanel'
import { initSync, useSync } from './sync/manager'

/** Đọc ?new=1 hoặc dữ liệu từ Web Share Target rồi dọn URL. */
function takeLaunchParams(): { open: boolean; text?: string } {
  const p = new URLSearchParams(location.search)
  const shared = [p.get('share_title'), p.get('share_text'), p.get('share_url')].filter(Boolean)
  const open = p.has('new') || shared.length > 0
  if (location.search) history.replaceState(null, '', location.pathname + location.hash)
  return { open, text: shared.length ? [...new Set(shared)].join('\n') : undefined }
}

const LAUNCH = takeLaunchParams()

export default function App() {
  const route = useRoute()
  const { theme, reviewAfterDays } = useSettings()
  const online = useOnline()
  const sync = useSync()
  const [capture, setCapture] = useState<{ text?: string } | null>(LAUNCH.open ? { text: LAUNCH.text } : null)
  const [query, setQuery] = useState('')
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

  const dueCount = useLiveQuery(async () => {
    const cutoff = Date.now() - reviewAfterDays * 86400_000
    return db.ideas
      .filter((i) => ['spark', 'exploring', 'validating', 'building', 'parked'].includes(i.status) && (i.reviewedAt ?? i.createdAt) < cutoff)
      .count()
  }, [reviewAfterDays])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    initSync()
    // Xin trình duyệt giữ dữ liệu lâu dài (Chrome thường tự cho khi app đã cài)
    navigator.storage?.persist?.().catch(() => {})
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        setCapture({})
      } else if (e.key === '/') {
        e.preventDefault()
        if (route.name !== 'list') go('/')
        setTimeout(() => searchRef.current?.focus(), 0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route.name])

  useEffect(() => {
    if (offlineReady) {
      const t = setTimeout(() => setOfflineReady(false), 4000)
      return () => clearTimeout(t)
    }
  }, [offlineReady, setOfflineReady])

  const titles: Record<string, string> = { review: 'Ôn lại', stats: 'Thống kê', settings: 'Cài đặt' }

  return (
    <div className="app">
      {route.name !== 'idea' && (
        <header className="topbar">
          {route.name === 'list' ? (
            <>
              <span className="logo" aria-hidden>
                💡
              </span>
              <input
                ref={searchRef}
                className="search"
                type="search"
                placeholder="Tìm ý tưởng, #tag…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Tìm kiếm"
              />
            </>
          ) : (
            <h1>{titles[route.name]}</h1>
          )}
          {!online && <span className="offline" title="Đang offline — mọi thứ vẫn được lưu trên máy">offline</span>}
          {sync.email && online && (
            <a href="#/settings" className={'sync-chip ' + sync.status} title={syncLabel(sync)} aria-label={syncLabel(sync)}>
              <span>{sync.status === 'syncing' ? '⟳' : sync.status === 'error' ? '⚠' : '☁'}</span>
              {sync.pending > 0 && sync.status !== 'syncing' ? sync.pending : sync.status === 'idle' ? '✓' : ''}
            </a>
          )}
        </header>
      )}

      {(needRefresh || offlineReady) && (
        <div className="banner">
          {needRefresh ? (
            <>
              <span>Có phiên bản mới.</span>
              <button className="btn primary" onClick={() => updateServiceWorker(true)}>
                Cập nhật
              </button>
            </>
          ) : (
            <span>✅ Sẵn sàng dùng offline</span>
          )}
        </div>
      )}

      <main className="main">
        {route.name === 'list' && <IdeaList query={query} onNew={() => setCapture({})} />}
        {route.name === 'idea' && <IdeaDetail id={route.id} />}
        {route.name === 'review' && <Review />}
        {route.name === 'stats' && <Stats />}
        {route.name === 'settings' && <Settings installEvent={installEvent} onInstalled={() => setInstallEvent(null)} />}
      </main>

      <nav className="bottomnav">
        <a href="#/" className={route.name === 'list' || route.name === 'idea' ? 'on' : ''}>
          <span>💡</span>Ý tưởng
        </a>
        <a href="#/review" className={route.name === 'review' ? 'on' : ''}>
          <span>🔁</span>Ôn lại
          {!!dueCount && <i className="badge">{dueCount > 99 ? '99+' : dueCount}</i>}
        </a>
        <button className="fab" onClick={() => setCapture({})} aria-label="Ghi ý tưởng mới">
          +
        </button>
        <a href="#/stats" className={route.name === 'stats' ? 'on' : ''}>
          <span>📊</span>Thống kê
        </a>
        <a href="#/settings" className={route.name === 'settings' ? 'on' : ''}>
          <span>⚙️</span>Cài đặt
        </a>
      </nav>

      {capture && <CaptureSheet initialText={capture.text} onClose={() => setCapture(null)} />}
    </div>
  )
}
