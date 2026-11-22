import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { BackupNudge } from './components/BackupNudge'
import { Home } from './components/Home'
import { IdeaPage } from './components/IdeaPage'
import { Mark } from './components/Mark'
import type { InstallPromptEvent } from './components/Settings'
import { SyncStatus, takePairLink } from './components/SyncPanel'
import { go, useRoute } from './lib/router'
import { useSettings } from './lib/settings'
import { initSync } from './sync/manager'
import { IS_DEMO, exitDemo } from './lib/demo'

/** Đọc ?new=1 hoặc dữ liệu từ Web Share Target rồi dọn URL. */
function takeLaunchParams(): { focus: boolean; text?: string } {
  const p = new URLSearchParams(location.search)
  const shared = [p.get('share_title'), p.get('share_text'), p.get('share_url')].filter(Boolean)
  const focus = p.has('new') || shared.length > 0
  if (location.search) history.replaceState(null, '', location.pathname + location.hash)
  return { focus, text: shared.length ? [...new Set(shared)].join('\n') : undefined }
}

// Màn ít dùng tải khi cần. Service worker đã lưu sẵn nên offline vẫn mở được.
const Coach = lazy(() => import('./components/Coach').then((m) => ({ default: m.Coach })))
const Settings = lazy(() => import('./components/Settings').then((m) => ({ default: m.Settings })))

const LAUNCH = takeLaunchParams()
// mở bằng link ghép máy → vào thẳng Cài đặt với mã đã điền sẵn
takePairLink()

export default function App() {
  const route = useRoute()
  const { theme } = useSettings()
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

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

  // N: ghi ý tưởng mới (kéo về trang chủ rồi vào ô ghi); /: tìm
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'n' || e.key === 'N' || e.key === '/') {
        e.preventDefault()
        if (route.name !== 'home') go('/')
        setTimeout(() => {
          if (e.key === '/') document.querySelector<HTMLInputElement>('.home-search input')?.focus()
          else window.dispatchEvent(new Event('ideos:focus-composer'))
        }, 60)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route.name])

  const home = route.name === 'home'

  return (
    <div className="app">
      <header className="bar">
        {home ? (
          <a className="brand" href="#/">
            <Mark size={24} />
            <span>Ideos</span>
          </a>
        ) : (
          <button className="btn ghost bar-back" onClick={() => go(route.name === 'coach' ? '/idea/' + route.id : '/')}>
            <ArrowLeft size={20} strokeWidth={2} aria-hidden /> {route.name === 'coach' ? 'Ý tưởng' : 'Ideos'}
          </button>
        )}
        <div className="push" />
        <SyncStatus compact />
        {route.name !== 'settings' && (
          <a className="icon-btn" href="#/settings" aria-label="Cài đặt" title="Cài đặt">
            <SettingsIcon size={22} strokeWidth={1.8} />
          </a>
        )}
      </header>

      <main>
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
        {!IS_DEMO && <BackupNudge />}
        <Suspense fallback={<div className="route-loading" role="status" aria-label="Đang tải" />}>
          {route.name === 'home' && <Home initialText={LAUNCH.text} focusComposer={LAUNCH.focus} />}
          {route.name === 'idea' && <IdeaPage key={route.id} id={route.id} />}
          {route.name === 'coach' && <Coach id={route.id} />}
          {route.name === 'settings' && <Settings installEvent={installEvent} onInstalled={() => setInstallEvent(null)} />}
        </Suspense>
      </main>
    </div>
  )
}
