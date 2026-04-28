const PREFERRED_VOICE_PATTERN = /Samantha|Allison|Ava|Joanna|Natural/i

let cachedVoice: SpeechSynthesisVoice | null = null
let cacheReady = false

function selectVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const enUS = voices.filter((v) => v.lang === 'en-US')
  const preferred = enUS.find((v) => PREFERRED_VOICE_PATTERN.test(v.name))
  if (preferred) return preferred
  if (enUS.length > 0) return enUS[0]
  return null
}

function tryFillCacheSync(): boolean {
  if (cacheReady) return true
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return false
  cachedVoice = selectVoice(voices)
  cacheReady = true
  return true
}

function speakWithVoice(text: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const utter = new SpeechSynthesisUtterance(text)
    if (cachedVoice) utter.voice = cachedVoice
    utter.rate = 1.0
    utter.pitch = 1.0
    utter.volume = 1.0
    utter.onend = () => resolve()
    utter.onerror = (event) => {
      reject(new Error(`TTS error: ${event.error}`))
    }
    window.speechSynthesis.speak(utter)
  })
}

export function speak(text: string): Promise<void> {
  if (tryFillCacheSync()) return speakWithVoice(text)
  return new Promise<void>((resolve, reject) => {
    const onChange = (): void => {
      const voices = window.speechSynthesis.getVoices()
      cachedVoice = selectVoice(voices)
      cacheReady = true
      window.speechSynthesis.removeEventListener('voiceschanged', onChange)
      speakWithVoice(text).then(resolve, reject)
    }
    window.speechSynthesis.addEventListener('voiceschanged', onChange)
  })
}

export function cancel(): void {
  window.speechSynthesis.cancel()
}

export function _resetVoiceCacheForTesting(): void {
  cachedVoice = null
  cacheReady = false
}
