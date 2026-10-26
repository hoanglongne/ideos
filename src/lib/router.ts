import { useEffect, useState } from 'react'

export type Route =
  | { name: 'list' }
  | { name: 'idea'; id: string }
  | { name: 'coach'; id: string }
  | { name: 'review' }
  | { name: 'stats' }
  | { name: 'settings' }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  switch (parts[0]) {
    case 'idea':
      if (!parts[1]) return { name: 'list' }
      return parts[2] === 'coach' ? { name: 'coach', id: decodeURIComponent(parts[1]) } : { name: 'idea', id: decodeURIComponent(parts[1]) }
    case 'review':
    case 'stats':
    case 'settings':
      return { name: parts[0] }
    default:
      return { name: 'list' }
  }
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
