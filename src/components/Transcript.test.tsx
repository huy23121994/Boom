import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { Transcript } from '@/components/Transcript'
import { useConversationStore } from '@/state/conversation'

beforeEach(() => {
  useConversationStore.setState({
    turns: [],
    prefs: { persistEnabled: false, theme: 'light', version: 1 },
  })
})

describe('Transcript — visibility', () => {
  it('is hidden (no is-open) when closed', () => {
    const { container } = render(<Transcript open={false} onClose={vi.fn()} />)
    const panel = container.querySelector('.transcript')
    expect(panel).not.toBeNull()
    expect(panel?.classList.contains('is-open')).toBe(false)
    expect(panel).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows is-open class when open', () => {
    const { container } = render(<Transcript open={true} onClose={vi.fn()} />)
    expect(container.querySelector('.transcript.is-open')).not.toBeNull()
  })
})

describe('Transcript — content', () => {
  it('shows empty state when no turns', () => {
    render(<Transcript open={true} onClose={vi.fn()} />)
    expect(screen.getByText(/your conversation will appear here/i)).toBeInTheDocument()
  })

  it('renders turns with speaker label and text', () => {
    useConversationStore.setState({
      turns: [
        { id: 't1', speaker: 'learner', text: 'Hello tutor', timestamp: Date.now() },
        { id: 't2', speaker: 'tutor', text: 'Hi back!', timestamp: Date.now() },
      ],
    })
    render(<Transcript open={true} onClose={vi.fn()} />)
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Tutor')).toBeInTheDocument()
    expect(screen.getByText('Hello tutor')).toBeInTheDocument()
    expect(screen.getByText('Hi back!')).toBeInTheDocument()
  })

  it('close button calls onClose', async () => {
    const onClose = vi.fn()
    render(<Transcript open={true} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /close transcript/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('Transcript — persistence toggle', () => {
  it('reflects current persistEnabled state', () => {
    useConversationStore.setState({
      prefs: { persistEnabled: true, theme: 'light', version: 1 },
    })
    render(<Transcript open={true} onClose={vi.fn()} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('toggling fires togglePersist on the store', async () => {
    useConversationStore.setState({
      prefs: { persistEnabled: false, theme: 'light', version: 1 },
    })
    render(<Transcript open={true} onClose={vi.fn()} />)
    const toggle = screen.getByRole('switch')
    await userEvent.click(toggle)
    expect(useConversationStore.getState().prefs.persistEnabled).toBe(true)
  })
})

describe('Transcript — clear all', () => {
  it('Clear all is disabled when there are no turns', () => {
    render(<Transcript open={true} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /clear all/i })).toBeDisabled()
  })

  it('Clear all is enabled when there are turns', () => {
    useConversationStore.setState({
      turns: [{ id: 't1', speaker: 'learner', text: 'hi', timestamp: 1 }],
    })
    render(<Transcript open={true} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /clear all/i })).not.toBeDisabled()
  })

  it('Clear all calls clearAll on confirmation', async () => {
    useConversationStore.setState({
      turns: [{ id: 't1', speaker: 'learner', text: 'hi', timestamp: 1 }],
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Transcript open={true} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(useConversationStore.getState().turns).toEqual([])
    confirmSpy.mockRestore()
  })

  it('Clear all does NOT clear if user cancels confirmation', async () => {
    useConversationStore.setState({
      turns: [{ id: 't1', speaker: 'learner', text: 'hi', timestamp: 1 }],
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<Transcript open={true} onClose={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /clear all/i }))
    expect(useConversationStore.getState().turns).toHaveLength(1)
    confirmSpy.mockRestore()
  })
})
