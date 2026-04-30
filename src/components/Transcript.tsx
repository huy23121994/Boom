import { useEffect, useRef, type FC, type ReactNode } from 'react'
import {
  useConversationStore,
  usePrefs,
  useTurns,
  type ConversationTurn,
} from '@/state/conversation'

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

const CORRECTION_PATTERN = /\b[Bb]y the way,?\s+(?:we (?:usually|normally|often) say|you (?:can|could|might|should) say|it(?:'s| is) (?:better|more natural|more common) to say|the correct (?:way|form) is|instead of)\b/

function highlightCorrections(text: string): ReactNode {
  const match = text.match(CORRECTION_PATTERN)
  if (!match || match.index === undefined) return text

  const before = text.slice(0, match.index)
  const rest = text.slice(match.index)

  return (
    <>
      {before}
      <span className="correction-highlight">{rest}</span>
    </>
  )
}

export const Transcript: FC<TranscriptProps> = ({ open, onClose }) => {
  const turns = useTurns()
  const prefs = usePrefs()
  const listRef = useRef<HTMLDivElement>(null)
  const now = Date.now()

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [open, turns.length])

  const handleTogglePersist = (): void => {
    useConversationStore.getState().togglePersist(!prefs.persistEnabled)
  }

  const handleClearAll = (): void => {
    if (turns.length === 0) return
    if (window.confirm('Clear all conversation history? This cannot be undone.')) {
      useConversationStore.getState().clearAll()
    }
  }

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
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
      </header>
      <div className="transcript-toolbar">
        <button
          type="button"
          role="switch"
          aria-checked={prefs.persistEnabled}
          onClick={handleTogglePersist}
          className={`persist-toggle ${prefs.persistEnabled ? 'is-on' : ''}`}
        >
          <span className="persist-track" aria-hidden="true">
            <span className="persist-thumb" />
          </span>
          <span className="persist-label">Save history</span>
        </button>
        <button
          type="button"
          onClick={handleClearAll}
          disabled={turns.length === 0}
          className="clear-all-button"
        >
          Clear all
        </button>
      </div>
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
  const isTutor = turn.speaker === 'tutor'
  return (
    <article className={`turn turn-${turn.speaker}`}>
      <div className="turn-meta">
        <span className="turn-speaker">
          {isTutor ? 'Tutor' : 'You'}
        </span>
        <span className="turn-time">{formatRelative(turn.timestamp, now)}</span>
      </div>
      {turn.error ? (
        <p className="turn-text turn-error" aria-label="Reply unavailable">
          Reply unavailable
        </p>
      ) : (
        <p className="turn-text">
          {isTutor ? highlightCorrections(turn.text) : turn.text}
        </p>
      )}
    </article>
  )
}
