import type { FC } from 'react'
import { preview } from '@/lib/tts'
import {
  SPEECH_RATE_VALUES,
  useConversationStore,
  usePrefs,
  type SpeechRate,
} from '@/state/conversation'

const CYCLE: SpeechRate[] = ['slow', 'normal', 'fast']

const LABELS: Record<SpeechRate, string> = {
  slow: '0.65x',
  normal: '0.85x',
  fast: '1x',
}

interface SpeedControlProps {
  pauseMic: () => void
  resumeMic: () => void
}

export const SpeedControl: FC<SpeedControlProps> = ({ pauseMic, resumeMic }) => {
  const { speechRate } = usePrefs()

  const handleCycle = (): void => {
    const idx = CYCLE.indexOf(speechRate)
    const next = CYCLE[(idx + 1) % CYCLE.length]
    useConversationStore.getState().setSpeechRate(next)
    pauseMic()
    void preview(SPEECH_RATE_VALUES[next]).then(resumeMic)
  }

  return (
    <button
      type="button"
      onClick={handleCycle}
      className="speed-control"
      aria-label={`Speech speed: ${speechRate}. Tap to change.`}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          d="M13 2v2.05A8 8 0 0 1 20 12a8 8 0 0 1-8 8 8 8 0 0 1-8-8 8 8 0 0 1 4-6.93V2.05A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 13 2z"
          fill="currentColor"
        />
        <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </svg>
      <span>{LABELS[speechRate]}</span>
    </button>
  )
}
