import { useState } from 'react'
import schemaSql from '../../supabase/schema.sql?raw'
import { timeAgo } from '../lib/util'
import { forgetConfig, requestSync, saveConfig, signIn, signOut, signUp, useSync, type SyncState } from '../sync/manager'
import { useToast } from './Toast'

export function syncLabel(s: SyncState): string {
  switch (s.status) {
    case 'syncing':
      return 'Đang đồng bộ…'
    case 'offline':
      return s.pending ? `Offline, ${s.pending} thay đổi chờ đẩy lên` : 'Offline, sẽ đồng bộ khi có mạng'
    case 'error':
      return 'Lỗi đồng bộ: ' + (s.error ?? 'không rõ') + '. Sẽ tự thử lại.'
    case 'idle':
      if (s.pending) return `${s.pending} thay đổi chờ đồng bộ`
      return s.lastSyncAt ? `Đã đồng bộ ${timeAgo(s.lastSyncAt)}` : 'Đã kết nối'
    default:
      return ''
  }
}

export function SyncPanel() {
  const s = useSync()
  return s.status === 'disabled' ? <Setup /> : !s.email ? <Login /> : <Connected s={s} />
}

/** Trạng thái đồng bộ gọn cho thanh bên / thanh trên điện thoại. */
export function SyncStatus({ compact }: { compact?: boolean }) {
  const s = useSync()
  if (!s.email && !compact) return null
  if (!s.email) return null
  const short = s.status === 'syncing' ? 'Đang đồng bộ' : s.status === 'error' ? 'Lỗi đồng bộ' : s.status === 'offline' ? 'Offline' : s.pending ? `${s.pending} chờ` : 'Đã đồng bộ'
  return (
    <a href="#/settings" className={'sync-status ' + s.status + (compact ? ' compact' : '')} title={syncLabel(s)}>
      <span className="sync-dot" aria-hidden="true" />
      <span>{compact ? short : syncLabel(s)}</span>
    </a>
  )
}

function useAction() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }
  return [busy, run] as const
}

function Setup() {
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [busy, run] = useAction()
  const toast = useToast()
  return (
    <>
      <p className="panel-note">Kết nối một project Supabase của riêng bạn. Gói miễn phí là đủ.</p>
      <details className="howto">
        <summary>Cách thiết lập, khoảng 3 phút</summary>
        <ol>
          <li>
            Tạo project miễn phí tại{' '}
            <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
              supabase.com
            </a>
          </li>
          <li>
            Mở <b>SQL Editor</b>, dán đoạn SQL rồi bấm <b>Run</b>.{' '}
            <button
              type="button"
              className="text-btn"
              onClick={async () => {
                await navigator.clipboard.writeText(schemaSql)
                toast('Đã chép SQL')
              }}
            >
              Chép SQL
            </button>
          </li>
          <li>
            Vào <b>Project Settings → API</b>, chép <b>Project URL</b> và <b>anon / publishable key</b> dán vào ô dưới
          </li>
          <li>
            Ở <b>Authentication → URL Configuration</b>, đặt <b>Site URL</b> là {location.origin} để link xác nhận email mở đúng app, hoặc tắt "Confirm email" nếu chỉ mình bạn dùng
          </li>
        </ol>
      </details>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => saveConfig(url, key))
        }}
      >
        <label className="field">
          <span className="field-label">Project URL</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" inputMode="url" autoComplete="off" aria-label="Project URL" />
        </label>
        <label className="field">
          <span className="field-label">Anon hoặc publishable key</span>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJ… hoặc sb_publishable_…" autoComplete="off" aria-label="API key" />
        </label>
        <button className="btn primary" disabled={busy || !url || !key}>
          Kết nối
        </button>
      </form>
    </>
  )
}

function Login() {
  const s = useSync()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, run] = useAction()
  const toast = useToast()
  return (
    <>
      <p className="panel-note">
        {mode === 'in' ? 'Đăng nhập cùng một tài khoản trên mọi máy để thấy chung ý tưởng.' : 'Tạo tài khoản trên project Supabase của bạn.'} Ý tưởng đang có trên máy này sẽ được gộp vào tài khoản.
      </p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          run(async () => {
            if (mode === 'in') await signIn(email, pw)
            else if (await signUp(email, pw)) {
              toast('Kiểm tra email để xác nhận, rồi quay lại đăng nhập')
              setMode('in')
            }
          })
        }}
      >
        <label className="field">
          <span className="field-label">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-label="Email" required />
        </label>
        <label className="field">
          <span className="field-label">Mật khẩu</span>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Ít nhất 6 ký tự"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            aria-label="Mật khẩu"
            minLength={6}
            required
          />
        </label>
        <button className="btn primary" disabled={busy}>
          {mode === 'in' ? 'Đăng nhập' : 'Tạo tài khoản'}
        </button>
      </form>
      <p className="panel-note">
        <button className="text-btn" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Chưa có tài khoản? Tạo mới' : 'Đã có tài khoản? Đăng nhập'}
        </button>
        {!s.configFromEnv && (
          <>
            {' · '}Server {s.url.replace(/^https?:\/\//, '')}{' '}
            <button className="text-btn" onClick={() => run(forgetConfig)}>
              Đổi
            </button>
          </>
        )}
      </p>
    </>
  )
}

function Connected({ s }: { s: SyncState }) {
  const [busy, run] = useAction()
  const [confirmOut, setConfirmOut] = useState(false)
  return (
    <>
      <div className={'sync-line ' + s.status}>
        <span className="sync-dot" aria-hidden="true" />
        <span>{syncLabel(s)}</span>
      </div>
      <p className="panel-note">Tài khoản {s.email}</p>
      <div className="row-actions">
        <button className="btn" disabled={s.status === 'syncing'} onClick={() => requestSync(0)}>
          Đồng bộ ngay
        </button>
        <button className="text-btn" onClick={() => setConfirmOut(!confirmOut)} aria-expanded={confirmOut}>
          Đăng xuất
        </button>
      </div>
      {confirmOut && (
        <div className="confirm-box">
          {s.pending > 0 && <p className="panel-note danger-text">Còn {s.pending} thay đổi chưa đồng bộ. App sẽ cố đẩy lên trước khi thoát.</p>}
          <div className="row-actions">
            <button className="btn" disabled={busy} onClick={() => run(() => signOut(false))}>
              Thoát, giữ dữ liệu trên máy
            </button>
            <button className="text-btn danger" disabled={busy || (s.pending > 0 && s.status === 'offline')} onClick={() => run(() => signOut(true))}>
              Thoát & xoá dữ liệu trên máy này
            </button>
          </div>
        </div>
      )}
    </>
  )
}
