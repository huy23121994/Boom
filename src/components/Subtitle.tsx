import type { FC } from 'react'
import { useBubbleState, useInterimTranscript, useSubtitle } from '@/state/conversation'

export const Subtitle: FC = () => {
  const subtitle = useSubtitle()
  const interim = useInterimTranscript()
  const state = useBubbleState()

  const isListening = state === 'listening'
  const text = isListening ? interim : subtitle
  const visible = text.length > 0

  return (
    <div className={`subtitle-bar ${visible ? 'is-visible' : ''}`} aria-live="polite">
      <span className={`subtitle-text ${isListening ? 'is-user' : 'is-tutor'}`}>
        {text}
      </span>
    </div>
  )
}
