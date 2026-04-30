import type { FC } from 'react'
import { useConversationStore, useTheme } from '@/state/conversation'
import { resolveTheme } from '@/lib/theme'

const SunIcon: FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2" fill="currentColor" />
    <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 3v2.4" />
      <path d="M12 18.6V21" />
      <path d="M3 12h2.4" />
      <path d="M18.6 12H21" />
      <path d="M5.6 5.6l1.7 1.7" />
      <path d="M16.7 16.7l1.7 1.7" />
      <path d="M5.6 18.4l1.7-1.7" />
      <path d="M16.7 7.3l1.7-1.7" />
    </g>
  </svg>
)

const MoonIcon: FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path
      d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"
      fill="currentColor"
    />
  </svg>
)

export const ThemeToggle: FC = () => {
  const theme = useTheme()
  const isDark = resolveTheme(theme) === 'dark'

  const handleToggle = (): void => {
    useConversationStore.getState().setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="theme-toggle"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
