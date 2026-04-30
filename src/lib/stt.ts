export interface STTCallbacks {
  onFinalTranscript: (text: string) => void
  onInterimTranscript?: (text: string) => void
  onError: (error: Error) => void
}

export interface STTHandle {
  stop: () => void
}

interface RecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((event: RecognitionEventLike) => void) | null
  onend: ((event: Event) => void) | null
  onerror: ((event: { error?: string }) => void) | null
}

interface RecognitionEventLike {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

const MAX_AUTO_RESTARTS = 3

function getRecognitionCtor(): (new () => RecognitionLike) | undefined {
  const w = window as unknown as {
    webkitSpeechRecognition?: new () => RecognitionLike
    SpeechRecognition?: new () => RecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function startRecognition(cb: STTCallbacks): STTHandle {
  const Ctor = getRecognitionCtor()
  if (!Ctor) {
    cb.onError(new Error('SpeechRecognition not supported'))
    return { stop: () => {} }
  }

  let stopped = false
  let restartCount = 0
  let recognition: RecognitionLike | null = null
  let finalText = ''

  function deliverFinal(): void {
    const trimmed = finalText.trim()
    if (trimmed.length > 0) cb.onFinalTranscript(trimmed)
  }

  function start(): void {
    recognition = new Ctor!()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          const chunk = result[0].transcript
          if (finalText.length > 0 && !finalText.endsWith(' ') && !chunk.startsWith(' ')) {
            finalText += ' '
          }
          finalText += chunk
        } else {
          interim += result[0].transcript
        }
      }
      if (interim.length > 0) {
        const separator = finalText.length > 0 && !finalText.endsWith(' ') && !interim.startsWith(' ') ? ' ' : ''
        cb.onInterimTranscript?.(finalText + separator + interim)
      }
    }

    recognition.onend = () => {
      if (stopped) {
        deliverFinal()
        return
      }
      if (restartCount >= MAX_AUTO_RESTARTS) {
        cb.onError(
          new Error(
            `SpeechRecognition: ${MAX_AUTO_RESTARTS} consecutive auto-end events`,
          ),
        )
        return
      }
      restartCount++
      try {
        recognition!.start()
      } catch (err) {
        cb.onError(err instanceof Error ? err : new Error(String(err)))
      }
    }

    recognition.onerror = (event) => {
      cb.onError(new Error(`SpeechRecognition error: ${event.error ?? 'unknown'}`))
    }

    recognition.start()
  }

  start()

  return {
    stop: () => {
      stopped = true
      recognition?.stop()
    },
  }
}
