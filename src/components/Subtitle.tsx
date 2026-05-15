import type { FC } from 'react'
import { useInterimTranscript, useSubtitle, useSubtitleVi, useTranslationEnabled } from '@/state/conversation'

export const Subtitle: FC = () => {
  const aiSubtitle = useSubtitle()
  const aiSubtitleVi = useSubtitleVi()
  const userInterim = useInterimTranscript()
  const translationEnabled = useTranslationEnabled()

  const showAi = aiSubtitle.length > 0
  const showUser = userInterim.length > 0
  const showVi = translationEnabled && aiSubtitleVi.length > 0

  return (
    <div className="subtitle-container">
      <div className={`subtitle-bar subtitle-ai ${showAi ? 'is-visible' : ''}`} aria-live="polite">
        <span className="subtitle-text is-tutor">
          <span className="subtitle-en">{aiSubtitle}</span>
          {showVi && <span className="subtitle-vi">{aiSubtitleVi}</span>}
        </span>
      </div>
      <div className={`subtitle-bar subtitle-user ${showUser ? 'is-visible' : ''}`} aria-live="polite">
        <span className="subtitle-text is-user">{userInterim}</span>
      </div>
    </div>
  )
}
