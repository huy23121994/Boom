import type { FC } from 'react'
import { useInterimTranscript, useSubtitle } from '@/state/conversation'

export const Subtitle: FC = () => {
  const aiSubtitle = useSubtitle()
  const userInterim = useInterimTranscript()

  const showAi = aiSubtitle.length > 0
  const showUser = userInterim.length > 0

  return (
    <div className="subtitle-container">
      <div className={`subtitle-bar subtitle-ai ${showAi ? 'is-visible' : ''}`} aria-live="polite">
        <span className="subtitle-text is-tutor">{aiSubtitle}</span>
      </div>
      <div className={`subtitle-bar subtitle-user ${showUser ? 'is-visible' : ''}`} aria-live="polite">
        <span className="subtitle-text is-user">{userInterim}</span>
      </div>
    </div>
  )
}
