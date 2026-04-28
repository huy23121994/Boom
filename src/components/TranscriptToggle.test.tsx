import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import userEvent from '@testing-library/user-event'
import { TranscriptToggle } from '@/components/TranscriptToggle'

describe('TranscriptToggle', () => {
  it('shows correct aria-label when off', () => {
    render(<TranscriptToggle open={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Show transcript')
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows correct aria-label when on', () => {
    render(<TranscriptToggle open={true} onToggle={vi.fn()} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Hide transcript')
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('applies is-on class when open', () => {
    const { container } = render(<TranscriptToggle open={true} onToggle={vi.fn()} />)
    expect(container.querySelector('.transcript-toggle.is-on')).not.toBeNull()
  })

  it('does NOT have is-on when closed', () => {
    const { container } = render(<TranscriptToggle open={false} onToggle={vi.fn()} />)
    expect(container.querySelector('.transcript-toggle.is-on')).toBeNull()
  })

  it('clicking calls onToggle once', async () => {
    const onToggle = vi.fn()
    render(<TranscriptToggle open={false} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
