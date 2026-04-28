import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import { Bubble } from '@/components/Bubble'
import { useConversationStore } from '@/state/conversation'

beforeEach(() => {
  useConversationStore.setState({ bubbleState: 'thinking' })
})

describe('Bubble — visual state', () => {
  it('uses is-speaking on stage when bubble state is speaking', () => {
    useConversationStore.setState({ bubbleState: 'speaking' })
    const { container } = render(<Bubble onTap={vi.fn()} started={true} />)
    expect(container.querySelector('.bubble-stage.is-speaking')).not.toBeNull()
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Tutor is speaking')
  })

  it('uses is-listening on stage when bubble state is listening', () => {
    useConversationStore.setState({ bubbleState: 'listening' })
    const { container } = render(<Bubble onTap={vi.fn()} started={true} />)
    expect(container.querySelector('.bubble-stage.is-listening')).not.toBeNull()
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Listening — speak when ready')
  })

  it('uses is-thinking on stage when bubble state is thinking', () => {
    useConversationStore.setState({ bubbleState: 'thinking' })
    const { container } = render(<Bubble onTap={vi.fn()} started={true} />)
    expect(container.querySelector('.bubble-stage.is-thinking')).not.toBeNull()
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Thinking')
  })

  it('uses is-idle on stage and renders Tap to start when not started', () => {
    useConversationStore.setState({ bubbleState: 'thinking' })
    const { container } = render(<Bubble onTap={vi.fn()} started={false} />)
    expect(container.querySelector('.bubble-stage.is-idle')).not.toBeNull()
    expect(screen.getByRole('button')).toHaveAttribute(
      'aria-label',
      'Tap to start the conversation',
    )
  })
})

describe('Bubble — tap dispatch', () => {
  it('tap during listening fires onTap exactly once', () => {
    useConversationStore.setState({ bubbleState: 'listening' })
    const onTap = vi.fn()
    render(<Bubble onTap={onTap} started={true} />)
    const btn = screen.getByRole('button')
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    expect(onTap).toHaveBeenCalledOnce()
  })

  it('tap during speaking does NOT fire onTap (FR-008/FR-027)', () => {
    useConversationStore.setState({ bubbleState: 'speaking' })
    const onTap = vi.fn()
    render(<Bubble onTap={onTap} started={true} />)
    const btn = screen.getByRole('button')
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('tap during thinking does NOT fire onTap (FR-027)', () => {
    useConversationStore.setState({ bubbleState: 'thinking' })
    const onTap = vi.fn()
    render(<Bubble onTap={onTap} started={true} />)
    const btn = screen.getByRole('button')
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('tap when not started fires onTap (start gate)', () => {
    useConversationStore.setState({ bubbleState: 'thinking' })
    const onTap = vi.fn()
    render(<Bubble onTap={onTap} started={false} />)
    const btn = screen.getByRole('button')
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    expect(onTap).toHaveBeenCalledOnce()
  })
})
