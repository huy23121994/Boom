import { useEffect, useState } from 'react'
import { Bubble } from '@/components/Bubble'
import { MicPermissionError } from '@/components/MicPermissionError'
import { SpeedControl } from '@/components/SpeedControl'
import { Subtitle } from '@/components/Subtitle'
import { VoiceSelector } from '@/components/VoiceSelector'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Transcript } from '@/components/Transcript'
import { TranscriptToggle } from '@/components/TranscriptToggle'
import { useConversationLoop } from '@/hooks/useConversationLoop'
import { loadPrefs, loadTranscript } from '@/lib/storage'
import { setVoiceName, unlock as unlockTts } from '@/lib/tts'
import { useConversationStore } from '@/state/conversation'

function App() {
  const [started, setStarted] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(false)

  useEffect(() => {
    const prefs = loadPrefs()
    const persistedTurns = prefs.persistEnabled ? loadTranscript() : []
    useConversationStore.getState().boot({ persistedTurns, prefs })
    if (prefs.voiceName) setVoiceName(prefs.voiceName)
  }, [])

  const { begin, stop, endTurnByTap, interruptSpeaking, pauseMic, resumeMic, retryAfterMicError } = useConversationLoop()

  const handleBubbleTap = (): void => {
    if (!started) {
      unlockTts()
      setStarted(true)
      begin()
      return
    }
    endTurnByTap()
    interruptSpeaking()
  }

  const handleStop = (): void => {
    stop()
    setStarted(false)
  }

  return (
    <main className="app-shell">
      <TranscriptToggle
        open={transcriptOpen}
        onToggle={() => setTranscriptOpen((v) => !v)}
      />
      <ThemeToggle />

      <div className="bubble-area">
        <Bubble onTap={handleBubbleTap} started={started} />
        {started && (
          <div className="controls-row">
            <VoiceSelector pauseMic={pauseMic} resumeMic={resumeMic} />
            <SpeedControl pauseMic={pauseMic} resumeMic={resumeMic} />
            <button
              type="button"
              onClick={handleStop}
              className="stop-button"
              aria-label="End conversation"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <rect x="7" y="7" width="10" height="10" rx="1.6" fill="currentColor" />
              </svg>
              <span>End</span>
            </button>
          </div>
        )}
      </div>

      <Subtitle />

      <Transcript open={transcriptOpen} onClose={() => setTranscriptOpen(false)} />
      <MicPermissionError
        onRetry={() => {
          void retryAfterMicError()
        }}
      />
    </main>
  )
}

export default App
