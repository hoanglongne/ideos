import { useEffect, useState } from 'react'

export type Route = { name: 'home' } | { name: 'idea'; id: string } | { name: 'coach'; id: string } | { name: 'settings' }

/** Chỉ còn bốn màn: trang chủ, một ý tưởng, mài ý tưởng, cài đặt. Đường dẫn cũ (ôn lại, thống kê, danh sách) về trang chủ. */
export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'idea' && parts[1]) return parts[2] === 'coach' ? { name: 'coach', id: decodeURIComponent(parts[1]) } : { name: 'idea', id: decodeURIComponent(parts[1]) }
  if (parts[0] === 'settings') return { name: 'settings' }
  return { name: 'home' }
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(location.hash))
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export const go = (path: string) => {
  location.hash = path
}

export function back() {
  if (history.length > 1) history.back()
  else go('/')
}
