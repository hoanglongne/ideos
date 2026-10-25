import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, Lightbulb, Plus, RotateCcw, Settings as SettingsIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { CaptureSheet } from './components/CaptureSheet'
import { IdeaDetail } from './components/IdeaDetail'
import { IdeaList } from './components/IdeaList'
import { Mark } from './components/Mark'
import { Review } from './components/Review'
import { Settings, type InstallPromptEvent } from './components/Settings'
import { Stats } from './components/Stats'
import { SyncStatus, takePairLink } from './components/SyncPanel'
import { db } from './db'
import { go, useRoute, type Route } from './lib/router'
import { useSettings } from './lib/settings'
import { REVIEWABLE } from './types'
import { initSync } from './sync/manager'
import { IS_DEMO, exitDemo } from './lib/demo'

/** Đọc ?new=1 hoặc dữ liệu từ Web Share Target rồi dọn URL. */
function takeLaunchParams(): { open: boolean; text?: string } {
  const p = new URLSearchParams(location.search)
  const shared = [p.get('share_title'), p.get('share_text'), p.get('share_url')].filter(Boolean)
  const open = p.has('new') || shared.length > 0
  if (location.search) history.replaceState(null, '', location.pathname + location.hash)
  return { open, text: shared.length ? [...new Set(shared)].join('\n') : undefined }
}

const LAUNCH = takeLaunchParams()
// mở bằng link ghép máy → vào thẳng Cài đặt với mã đã điền sẵn
takePairLink()

const NAV: { route: Route['name']; href: string; label: string; short: string; Icon: typeof Lightbulb }[] = [
  { route: 'list', href: '#/', label: 'Ý tưởng', short: 'Ý tưởng', Icon: Lightbulb },
  { route: 'review', href: '#/review', label: 'Ôn lại', short: 'Ôn lại', Icon: RotateCcw },
  { route: 'stats', href: '#/stats', label: 'Thống kê', short: 'Thống kê', Icon: BarChart3 },
]

export default function App() {
  const route = useRoute()
  const { theme, reviewAfterDays } = useSettings()
  const [capture, setCapture] = useState<{ text?: string } | null>(LAUNCH.open ? { text: LAUNCH.text } : null)
  const [query, setQuery] = useState('')
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  const dueCount = useLiveQuery(async () => {
    const cutoff = Date.now() - reviewAfterDays * 86400_000
    return db.ideas.filter((i) => REVIEWABLE.includes(i.status) && (i.reviewedAt ?? i.createdAt) < cutoff).count()
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

  const active = route.name === 'idea' ? 'list' : route.name
  const openCapture = () => setCapture({})

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Điều hướng">
        <a className="brand" href="#/">
          <Mark size={26} />
          <span>Ideos</span>
        </a>
        <button className="btn primary wide" onClick={openCapture}>
          <Plus size={16} strokeWidth={2} aria-hidden /> Ghi ý tưởng
          <kbd className="kbd-hint">N</kbd>
        </button>
        <nav className="nav">
          {NAV.map(({ route: r, href, label, Icon }) => (
            <a key={r} href={href} className={'nav-item' + (active === r ? ' on' : '')} aria-current={active === r ? 'page' : undefined}>
              <Icon size={16} strokeWidth={1.6} aria-hidden />
              <span>{label}</span>
              {r === 'review' && !!dueCount && <span className="nav-count num">{dueCount}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <a href="#/settings" className={'nav-item' + (active === 'settings' ? ' on' : '')} aria-current={active === 'settings' ? 'page' : undefined}>
            <SettingsIcon size={16} strokeWidth={1.6} aria-hidden />
            <span>Cài đặt</span>
          </a>
          <SyncStatus />
        </div>
      </aside>

      <header className="phonebar">
        <a className="brand" href="#/">
          <Mark size={22} />
          <span>Ideos</span>
        </a>
        <SyncStatus compact />
      </header>

      <main className="page">
        {IS_DEMO && (
          <div className="notice">
            <span>Bạn đang xem dữ liệu mẫu. Những gì ghi ở đây không lẫn vào dữ liệu thật.</span>
            <button className="btn" onClick={exitDemo}>
              Thoát bản mẫu
            </button>
          </div>
        )}
        {needRefresh && (
          <div className="notice">
            <span>Có phiên bản mới của Ideos.</span>
            <button className="btn" onClick={() => updateServiceWorker(true)}>
              Cập nhật
            </button>
          </div>
        )}
        {route.name === 'list' && <IdeaList query={query} onQuery={setQuery} searchRef={searchRef} onNew={openCapture} dueCount={dueCount ?? 0} />}
        {route.name === 'idea' && <IdeaDetail id={route.id} />}
        {route.name === 'review' && <Review />}
        {route.name === 'stats' && <Stats />}
        {route.name === 'settings' && <Settings installEvent={installEvent} onInstalled={() => setInstallEvent(null)} />}
      </main>

      <nav className="tabbar" aria-label="Điều hướng">
        {NAV.slice(0, 2).map(({ route: r, href, short, Icon }) => (
          <a key={r} href={href} className={active === r ? 'on' : ''} aria-current={active === r ? 'page' : undefined}>
            <Icon size={20} strokeWidth={1.6} aria-hidden />
            <span>{short}</span>
            {r === 'review' && !!dueCount && <i className="tab-count num">{dueCount > 99 ? '99+' : dueCount}</i>}
          </a>
        ))}
        <button className="tab-capture" onClick={openCapture} aria-label="Ghi ý tưởng mới">
          <Plus size={24} strokeWidth={2} aria-hidden />
        </button>
        {[NAV[2], { route: 'settings' as const, href: '#/settings', short: 'Cài đặt', Icon: SettingsIcon }].map(({ route: r, href, short, Icon }) => (
          <a key={r} href={href} className={active === r ? 'on' : ''} aria-current={active === r ? 'page' : undefined}>
            <Icon size={20} strokeWidth={1.6} aria-hidden />
            <span>{short}</span>
          </a>
        ))}
      </nav>

      {capture && <CaptureSheet initialText={capture.text} onClose={() => setCapture(null)} />}
    </div>
  )
}
