import { useEffect, useRef, type FC } from 'react'
import { useTurns, type ConversationTurn } from '@/state/conversation'

interface TranscriptProps {
  open: boolean
  onClose: () => void
}

function formatRelative(timestamp: number, now: number): string {
  const diffSec = Math.max(0, Math.round((now - timestamp) / 1000))
  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

export const Transcript: FC<TranscriptProps> = ({ open, onClose }) => {
  const turns = useTurns()
  const listRef = useRef<HTMLDivElement>(null)
  const now = Date.now()

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [open, turns.length])

  return (
    <aside
      className={`transcript ${open ? 'is-open' : ''}`}
      aria-hidden={!open}
      role="complementary"
      aria-label="Conversation transcript"
    >
      <header className="transcript-head">
        <span className="transcript-label">Conversation</span>
        <button
          type="button"
          aria-label="Close transcript"
          onClick={onClose}
          className="transcript-close"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
      </header>
      <div className="transcript-list" ref={listRef}>
        {turns.length === 0 ? (
          <p className="transcript-empty">Your conversation will appear here.</p>
        ) : (
          turns.map((turn) => <Turn key={turn.id} turn={turn} now={now} />)
        )}
      </div>
    </aside>
  )
}

const Turn: FC<{ turn: ConversationTurn; now: number }> = ({ turn, now }) => {
  return (
    <article className={`turn turn-${turn.speaker}`}>
      <div className="turn-meta">
        <span className="turn-speaker">
          {turn.speaker === 'learner' ? 'You' : 'Tutor'}
        </span>
        <span className="turn-time">{formatRelative(turn.timestamp, now)}</span>
      </div>
      <p className="turn-text">{turn.text}</p>
    </article>
  )
}
