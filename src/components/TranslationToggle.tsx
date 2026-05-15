import type { FC } from 'react'
import { useConversationStore, useTranslationEnabled } from '@/state/conversation'

export const TranslationToggle: FC = () => {
  const enabled = useTranslationEnabled()

  const handleToggle = (): void => {
    useConversationStore.getState().setTranslationEnabled(!enabled)
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={enabled ? 'Disable Vietnamese translation' : 'Enable Vietnamese translation'}
      aria-pressed={enabled}
      className={`translation-toggle ${enabled ? 'is-on' : ''}`}
    >
      <span className="translation-toggle-label">VI</span>
    </button>
  )
}
