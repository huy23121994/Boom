const PREFERRED_VOICE_PATTERN = /Samantha|Allison|Ava|Joanna|Natural/i

let cachedVoice: SpeechSynthesisVoice | null = null
let cacheReady = false
let selectedVoiceName: string | null = null

function selectVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (selectedVoiceName) {
    const match = voices.find((v) => v.name === selectedVoiceName)
    if (match) return match
  }
  const enUS = voices.filter((v) => v.lang.startsWith('en'))
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

function refreshCache(): void {
  cacheReady = false
  tryFillCacheSync()
}

export function setVoiceName(name: string | null): void {
  selectedVoiceName = name
  refreshCache()
}

const CURATED_VOICES = [
  'Samantha', 'Allison', 'Ava', 'Karen', 'Daniel',
  'Google US English',
  'Google UK English Female',
  'Google UK English Male',
]

function isCurated(name: string): boolean {
  return CURATED_VOICES.some((c) => name.startsWith(c))
}

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  const voices = window.speechSynthesis.getVoices()
  return voices.filter((v) => v.lang.startsWith('en') && isCurated(v.name))
}

export function getCurrentVoiceName(): string | null {
  return cachedVoice?.name ?? null
}

function speakWithVoice(text: string, rate: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const synth = window.speechSynthesis
    const utter = new SpeechSynthesisUtterance(text)
    if (cachedVoice) utter.voice = cachedVoice
    utter.rate = rate
    utter.pitch = 1.0
    utter.volume = 1.0

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      clearInterval(keepAlive)
      resolve()
    }

    utter.onend = finish
    utter.onerror = finish

    // iOS Safari: onend can silently never fire
    const watchdog = setTimeout(finish, Math.max(text.length * 150, 8000))

    // iOS Safari: pause+resume prevents engine from stalling mid-utterance
    const keepAlive = setInterval(() => {
      if (!synth.speaking) {
        finish()
        return
      }
      synth.pause()
      synth.resume()
    }, 3000)

    synth.speak(utter)
  })
}

export function speak(text: string, rate = 1.0): Promise<void> {
  if (tryFillCacheSync()) return speakWithVoice(text, rate)
  return new Promise<void>((resolve, reject) => {
    const onChange = (): void => {
      const voices = window.speechSynthesis.getVoices()
      cachedVoice = selectVoice(voices)
      cacheReady = true
      window.speechSynthesis.removeEventListener('voiceschanged', onChange)
      speakWithVoice(text, rate).then(resolve, reject)
    }
    window.speechSynthesis.addEventListener('voiceschanged', onChange)
  })
}

export function preview(rate: number): Promise<void> {
  window.speechSynthesis.cancel()
  return new Promise<void>((resolve) => {
    const utter = new SpeechSynthesisUtterance(
      "Hi there! Let's practice English together.",
    )
    if (cachedVoice) utter.voice = cachedVoice
    utter.rate = rate
    utter.pitch = 1.0
    utter.volume = 1.0
    utter.onend = () => resolve()
    utter.onerror = () => resolve()
    window.speechSynthesis.speak(utter)
  })
}

export function unlock(): void {
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(' ')
  utter.volume = 0
  window.speechSynthesis.speak(utter)
  // Clear queue so the silent utterance doesn't block real speech
  setTimeout(() => window.speechSynthesis.cancel(), 200)
}

export function cancel(): void {
  window.speechSynthesis.cancel()
}
