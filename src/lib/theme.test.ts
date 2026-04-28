import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyTheme, resolveTheme, subscribeSystemTheme } from '@/lib/theme'

interface MQLMock {
  matches: boolean
  media: string
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

let lastMQL: MQLMock | null = null
let systemPrefersDark = false

beforeEach(() => {
  document.documentElement.classList.remove('dark')
  systemPrefersDark = false
  lastMQL = null
  ;(window as unknown as { matchMedia: (q: string) => MQLMock }).matchMedia = (
    query: string,
  ) => {
    const mql: MQLMock = {
      matches: systemPrefersDark,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    lastMQL = mql
    return mql
  }
})

describe('resolveTheme', () => {
  it('returns "light" for mode "light"', () => {
    expect(resolveTheme('light')).toBe('light')
  })
  it('returns "dark" for mode "dark"', () => {
    expect(resolveTheme('dark')).toBe('dark')
  })
  it('returns "dark" for mode "system" when OS prefers dark', () => {
    systemPrefersDark = true
    expect(resolveTheme('system')).toBe('dark')
  })
  it('returns "light" for mode "system" when OS prefers light', () => {
    systemPrefersDark = false
    expect(resolveTheme('system')).toBe('light')
  })
})

describe('applyTheme', () => {
  it('adds the dark class for mode "dark"', () => {
    applyTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes the dark class for mode "light"', () => {
    document.documentElement.classList.add('dark')
    applyTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('consults matchMedia for mode "system"', () => {
    systemPrefersDark = true
    applyTheme('system')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    systemPrefersDark = false
    applyTheme('system')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})

describe('subscribeSystemTheme', () => {
  it('returns an unsubscribe function that removes the listener', () => {
    const cb = vi.fn()
    const unsub = subscribeSystemTheme(cb)
    expect(lastMQL?.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    unsub()
    expect(lastMQL?.removeEventListener).toHaveBeenCalledOnce()
  })

  it('invokes the callback with the resolved theme on change', () => {
    const cb = vi.fn()
    subscribeSystemTheme(cb)
    const handler = lastMQL?.addEventListener.mock.calls[0][1] as (e: { matches: boolean }) => void
    handler({ matches: true })
    expect(cb).toHaveBeenCalledWith('dark')
    handler({ matches: false })
    expect(cb).toHaveBeenLastCalledWith('light')
  })
})
