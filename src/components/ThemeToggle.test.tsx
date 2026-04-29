import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useConversationStore } from '@/state/conversation'

beforeEach(() => {
  useConversationStore.setState({
    prefs: { persistEnabled: false, theme: 'light', version: 1 },
  })
})

describe('ThemeToggle', () => {
  it('renders moon icon (and Switch to dark) when current theme is light', () => {
    useConversationStore.setState({
      prefs: { persistEnabled: false, theme: 'light', version: 1 },
    })
    render(<ThemeToggle />)
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Switch to dark theme',
    )
  })

  it('renders sun icon (and Switch to light) when current theme is dark', () => {
    useConversationStore.setState({
      prefs: { persistEnabled: false, theme: 'dark', version: 1 },
    })
    render(<ThemeToggle />)
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Switch to light theme',
    )
  })

  it('clicking from light flips theme to dark', async () => {
    useConversationStore.setState({
      prefs: { persistEnabled: false, theme: 'light', version: 1 },
    })
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button'))
    expect(useConversationStore.getState().prefs.theme).toBe('dark')
  })

  it('clicking from dark flips theme to light', async () => {
    useConversationStore.setState({
      prefs: { persistEnabled: false, theme: 'dark', version: 1 },
    })
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button'))
    expect(useConversationStore.getState().prefs.theme).toBe('light')
  })

  it('renders correctly when store has theme: system — resolves via matchMedia', () => {
    // Mock matchMedia to report system preference as dark
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
    useConversationStore.setState({
      prefs: { persistEnabled: false, theme: 'system', version: 1 },
    })
    render(<ThemeToggle />)
    // system resolves to dark via matchMedia → button shows "Switch to light"
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Switch to light theme',
    )
  })
})
