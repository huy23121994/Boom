import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { MicPermissionError } from '@/components/MicPermissionError'
import { useConversationStore } from '@/state/conversation'

beforeEach(() => {
  useConversationStore.setState({ activeError: undefined })
})

describe('MicPermissionError', () => {
  it('renders nothing when there is no mic-denied error', () => {
    useConversationStore.setState({ activeError: undefined })
    const { container } = render(<MicPermissionError onRetry={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for non-mic errors', () => {
    useConversationStore.setState({ activeError: 'transport' })
    const { container } = render(<MicPermissionError onRetry={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders error UI when activeError is mic-denied', () => {
    useConversationStore.setState({ activeError: 'mic-denied' })
    render(<MicPermissionError onRetry={vi.fn()} />)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText(/microphone access needed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('Try again button calls onRetry exactly once', async () => {
    useConversationStore.setState({ activeError: 'mic-denied' })
    const onRetry = vi.fn()
    render(<MicPermissionError onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
