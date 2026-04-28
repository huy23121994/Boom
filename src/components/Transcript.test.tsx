import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { Transcript } from '@/components/Transcript'
import { useConversationStore } from '@/state/conversation'

beforeEach(() => {
  useConversationStore.setState({ turns: [] })
})

describe('Transcript', () => {
  it('is hidden (no is-open) when closed', () => {
    const { container } = render(<Transcript open={false} onClose={vi.fn()} />)
    const panel = container.querySelector('.transcript')
    expect(panel).not.toBeNull()
    expect(panel?.classList.contains('is-open')).toBe(false)
    expect(panel).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows is-open class when open', () => {
    const { container } = render(<Transcript open={true} onClose={vi.fn()} />)
    const panel = container.querySelector('.transcript.is-open')
    expect(panel).not.toBeNull()
  })

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
