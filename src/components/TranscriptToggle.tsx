import type { FC } from 'react'

interface TranscriptToggleProps {
  open: boolean
  onToggle: () => void
}

export const TranscriptToggle: FC<TranscriptToggleProps> = ({ open, onToggle }) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? 'Hide transcript' : 'Show transcript'}
      aria-pressed={open}
      className={`transcript-toggle ${open ? 'is-on' : ''}`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M5 7h14M5 12h14M5 17h9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </button>
  )
}
