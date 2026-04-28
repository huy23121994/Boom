import type { ThemeMode } from '@/state/conversation'

const MEDIA_QUERY = '(prefers-color-scheme: dark)'

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light') return 'light'
  if (mode === 'dark') return 'dark'
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light'
}

export function applyTheme(mode: ThemeMode): void {
  const resolved = resolveTheme(mode)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

export function subscribeSystemTheme(
  cb: (resolved: 'light' | 'dark') => void,
): () => void {
  const mq = window.matchMedia(MEDIA_QUERY)
  const handler = (event: MediaQueryListEvent): void => {
    cb(event.matches ? 'dark' : 'light')
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
