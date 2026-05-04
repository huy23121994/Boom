import { useEffect, useState, type FC } from 'react'
import { getEnglishVoices, getCurrentVoiceName, preview, setVoiceName } from '@/lib/tts'
import {
  SPEECH_RATE_VALUES,
  useConversationStore,
  usePrefs,
} from '@/state/conversation'

interface VoiceSelectorProps {
  pauseMic: () => void
  resumeMic: () => void
}

export const VoiceSelector: FC<VoiceSelectorProps> = ({ pauseMic, resumeMic }) => {
  const { voiceName } = usePrefs()
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const load = () => {
      const v = getEnglishVoices()
      if (v.length > 0) setVoices(v)
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  useEffect(() => {
    if (!voiceName && voices.length > 0) {
      const fallback = getCurrentVoiceName() ?? voices[0].name
      setVoiceName(fallback)
      useConversationStore.getState().setVoiceName(fallback)
    }
  }, [voiceName, voices])

  const currentName = voiceName ?? getCurrentVoiceName() ?? ''
  const shortName = currentName.replace(/\s*\(.*\)/, '').split(' ').slice(0, 2).join(' ')

  const handleOpen = () => {
    pauseMic()
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    resumeMic()
  }

  const handleSelect = (name: string) => {
    setVoiceName(name)
    useConversationStore.getState().setVoiceName(name)
    setOpen(false)
    const rate = SPEECH_RATE_VALUES[useConversationStore.getState().prefs.speechRate]
    void preview(rate).then(resumeMic)
  }

  return (
    <div className="voice-selector">
      <button
        type="button"
        onClick={() => (open ? handleClose() : handleOpen())}
        className="voice-selector-trigger"
        aria-label={`Voice: ${currentName}. Tap to change.`}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Zm7 10a7 7 0 0 1-6 6.93V21h3v2H8v-2h3v-3.07A7 7 0 0 1 5 11h2a5 5 0 0 0 10 0h2Z"
            fill="currentColor"
          />
        </svg>
        <span className="voice-selector-name">{shortName}</span>
        <svg
          className={`voice-selector-chevron ${open ? 'is-open' : ''}`}
          viewBox="0 0 24 24"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {open && (
        <>
          <div className="voice-selector-backdrop" onClick={handleClose} />
          <div className="voice-selector-dropdown" role="listbox" aria-label="Select voice">
            {voices.map((v) => (
              <button
                type="button"
                role="option"
                aria-selected={currentName === v.name}
                key={v.name}
                className={`voice-option ${currentName === v.name ? 'is-selected' : ''}`}
                onClick={() => handleSelect(v.name)}
              >
                <span className="voice-option-name">{v.name.replace(/\s*\(.*\)/, '')}</span>
                <span className="voice-option-detail">{v.lang}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
