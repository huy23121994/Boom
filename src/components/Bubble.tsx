import type { FC } from 'react'
import { useBubbleState } from '@/state/conversation'

interface BubbleProps {
  onTap: () => void
  started: boolean
}

const STATE_LABEL = {
  speaking: 'Tutor is speaking',
  listening: 'Listening — speak when ready',
  thinking: 'Thinking',
  processing: 'Processing',
} as const

const STATUS_LINES = [
  { id: 'idle' as const, text: 'Tap to start' },
  { id: 'speaking' as const, text: 'Tutor is speaking' },
  { id: 'listening' as const, text: 'Listening — speak when ready' },
  { id: 'processing' as const, text: 'Processing your speech...' },
  { id: 'thinking' as const, text: 'Thinking...' },
]

export const Bubble: FC<BubbleProps> = ({ onTap, started }) => {
  const state = useBubbleState()
  const stageMode = !started ? 'idle' : state
  const stageClass = `is-${stageMode}`
  const ariaLabel = !started ? 'Tap to start the conversation' : STATE_LABEL[state]

  return (
    <div className="bubble-shell">
      <div className={`bubble-stage ${stageClass}`}>
        <div className="bubble-ripples" aria-hidden="true">
          <span className="ripple ripple-1" />
          <span className="ripple ripple-2" />
          <span className="ripple ripple-3" />
        </div>
        <div className="bubble-orbits" aria-hidden="true">
          <span className="orbit orbit-1">
            <span className="satellite" />
          </span>
          <span className="orbit orbit-2">
            <span className="satellite" />
          </span>
          <span className="orbit orbit-3">
            <span className="satellite" />
          </span>
        </div>
        <button
          type="button"
          aria-label={ariaLabel}
          className="bubble-core"
          onPointerDown={(event) => {
            event.preventDefault()
            if (!started) {
              onTap()
              return
            }
            if (state === 'listening' || state === 'speaking') onTap()
          }}
        >
          {!started && (
            <svg
              className="bubble-play"
              viewBox="0 0 24 24"
              width="32"
              height="32"
              aria-hidden="true"
            >
              <path d="M9 6.2v11.6L18.4 12z" fill="currentColor" />
            </svg>
          )}
        </button>
      </div>
      <div className="status" aria-live="polite">
        {STATUS_LINES.map((line) => (
          <span
            key={line.id}
            className={`status-line ${stageMode === line.id ? 'is-active' : ''}`}
          >
            {line.text}
          </span>
        ))}
      </div>
    </div>
  )
}
