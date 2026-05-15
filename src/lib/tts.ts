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
  'Samantha',
  'Ava',
  'Daniel',
  'Karen',
  'Google US English',
  'Google UK English Female',
  'Google UK English Male',
]

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  const voices = window.speechSynthesis.getVoices()
  const matches: SpeechSynthesisVoice[] = []
  for (const name of CURATED_VOICES) {
    const v = voices.find((v) => v.name.startsWith(name))
    if (v) matches.push(v)
  }
  return matches
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
    let started = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      clearTimeout(startTimeout)
      clearInterval(keepAlive)
      resolve()
    }

    utter.onstart = () => { started = true }
    utter.onend = finish
    utter.onerror = finish

    // iOS Safari: onend can silently never fire
    const watchdog = setTimeout(finish, Math.max(text.length * 150, 8000))

    // iOS Safari: if onstart never fires within 3s, utterance was silently blocked
    const startTimeout = setTimeout(() => { if (!started) finish() }, 3000)

    // iOS Safari: resume if paused (background → foreground); avoid pause/resume — causes audible glitches
    const keepAlive = setInterval(() => {
      if (!synth.speaking) {
        finish()
        return
      }
      if (synth.paused) synth.resume()
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
  // iOS Safari requires the first speak() in a user gesture to have real phonemic content
  // at volume > 0. A space character produces no audio samples so iOS skips opening the
  // audio session even with volume 1.0; 'a' is the shortest real phoneme.
  const utter = new SpeechSynthesisUtterance('a')
  utter.volume = 1.0
  utter.rate = 10
  window.speechSynthesis.speak(utter)
}

export function cancel(): void {
  window.speechSynthesis.cancel()
}
