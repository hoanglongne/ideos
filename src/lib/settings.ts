import { useSyncExternalStore } from 'react'

export interface Settings {
  geotag: boolean
  speechLang: string
  theme: 'system' | 'light' | 'dark'
  reviewAfterDays: number
}

const DEFAULTS: Settings = { geotag: false, speechLang: 'vi-VN', theme: 'system', reviewAfterDays: 7 }
const KEY = 'ideos.settings'

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return DEFAULTS
  }
}

let current = load()
const listeners = new Set<() => void>()

export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* private mode — vẫn chạy với settings trong bộ nhớ */
  }
  listeners.forEach((l) => l())
}

export const getSettings = () => current

export function useSettings() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}
