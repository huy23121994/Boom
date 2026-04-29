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

  it('renders turns with speaker label, text, and timestamp', () => {
    useConversationStore.setState({
      turns: [
        { id: 't1', speaker: 'learner', text: 'Hello tutor', timestamp: Date.now() - 5000 },
        { id: 't2', speaker: 'tutor', text: 'Hi back!', timestamp: Date.now() - 2000 },
      ],
    })
    render(<Transcript open={true} onClose={vi.fn()} />)
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Tutor')).toBeInTheDocument()
    expect(screen.getByText('Hello tutor')).toBeInTheDocument()
    expect(screen.getByText('Hi back!')).toBeInTheDocument()
    // Timestamps must be present
    const timestamps = document.querySelectorAll('.turn-time')
    expect(timestamps).toHaveLength(2)
    timestamps.forEach((ts) => expect(ts.textContent).toBeTruthy())
  })

  it('tutor-error turns render an inline indicator instead of empty text', () => {
    useConversationStore.setState({
      turns: [
        { id: 'e1', speaker: 'tutor', text: '', timestamp: Date.now(), error: 'transport' },
      ],
    })
    render(<Transcript open={true} onClose={vi.fn()} />)
    expect(screen.getByLabelText('Reply unavailable')).toBeInTheDocument()
    // Error turn should NOT render empty p.turn-text
    const turnTexts = document.querySelectorAll('p.turn-text')
    turnTexts.forEach((el) => expect(el.textContent?.trim()).not.toBe(''))
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

describe('Transcript — turn ordering', () => {
  it('renders turns in original order with latest at bottom', () => {
    useConversationStore.setState({
      turns: [
        { id: 't1', speaker: 'tutor', text: 'First message', timestamp: 1000 },
        { id: 't2', speaker: 'learner', text: 'Second message', timestamp: 2000 },
        { id: 't3', speaker: 'tutor', text: 'Third message', timestamp: 3000 },
      ],
    })
    const { container } = render(<Transcript open={true} onClose={vi.fn()} />)
    const articles = container.querySelectorAll('article')
    expect(articles).toHaveLength(3)
    expect(articles[0].textContent).toContain('First message')
    expect(articles[1].textContent).toContain('Second message')
    expect(articles[2].textContent).toContain('Third message')
  })
})

describe('Transcript — no state dispatch on list tap (SC-011)', () => {
  it('clicking the transcript list area does not mutate store state', async () => {
    useConversationStore.setState({
      turns: [
        { id: 't1', speaker: 'tutor', text: 'Hello learner', timestamp: Date.now() },
      ],
    })
    const { container } = render(<Transcript open={true} onClose={vi.fn()} />)
    const stateBefore = JSON.stringify(useConversationStore.getState().turns)
    const listEl = container.querySelector('.transcript-list')
    if (listEl) await userEvent.click(listEl)
    const stateAfter = JSON.stringify(useConversationStore.getState().turns)
    expect(stateAfter).toBe(stateBefore)
  })

  it('interim STT text does not appear in the transcript DOM (SC-011 visual leg)', async () => {
    // Set up a fake SpeechRecognition so startRecognition wires up onresult
    const mockRecognition = {
      lang: '',
      interimResults: false,
      continuous: false,
      start: vi.fn(),
      stop: vi.fn(),
      onresult: null as ((e: unknown) => void) | null,
      onend: null as ((e: Event) => void) | null,
      onerror: null as ((e: unknown) => void) | null,
    }
    // Constructor must return an object to override `new` allocation
    function MockRecognition() { return mockRecognition }
    ;(window as any).SpeechRecognition = MockRecognition

    const { startRecognition } = await import('@/lib/stt')
    const callbacks = { onFinalTranscript: vi.fn(), onError: vi.fn() }
    startRecognition(callbacks)

    // One finalized greeting is in the store
    useConversationStore.setState({
      turns: [{ id: 'g1', speaker: 'tutor', text: 'Hello!', timestamp: Date.now() }],
    })

    const { container } = render(<Transcript open={true} onClose={vi.fn()} />)
    const initialCount = container.querySelectorAll('article').length

    // Fire an interim (non-final) STT event — stt.ts discards it, store untouched
    mockRecognition.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'partial learner text...' } }],
    } as unknown)

    // DOM must be unchanged: no partial text visible, same article count
    expect(container.querySelectorAll('article')).toHaveLength(initialCount)
    expect(screen.queryByText(/partial learner text/i)).not.toBeInTheDocument()
    expect(callbacks.onFinalTranscript).not.toHaveBeenCalled()

    delete (window as any).SpeechRecognition
  })
})
