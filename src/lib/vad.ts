export interface VADCallbacks {
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
}

export interface VADOptions extends VADCallbacks {
  energyThreshold?: number
  silenceEndMs?: number
  minSpeechMs?: number
}

export interface VADHandle {
  stop: () => void
}

const DEFAULT_ENERGY_THRESHOLD = 22
const DEFAULT_SILENCE_END_MS = 2200
const DEFAULT_MIN_SPEECH_MS = 0

export async function startVAD(opts: VADOptions): Promise<VADHandle> {
  const energyThreshold = opts.energyThreshold ?? DEFAULT_ENERGY_THRESHOLD
  const silenceEndMs = opts.silenceEndMs ?? DEFAULT_SILENCE_END_MS
  const minSpeechMs = opts.minSpeechMs ?? DEFAULT_MIN_SPEECH_MS

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext
  const ctx = new AudioCtor()
  const source = ctx.createMediaStreamSource(stream)
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  analyser.smoothingTimeConstant = 0.5
  source.connect(analyser)

  const data = new Uint8Array(analyser.frequencyBinCount)
  let speechActive = false
  let speechStartedAt: number | null = null
  let speechConfirmed = false
  let silenceStartedAt: number | null = null
  let stopped = false
  let raf = 0

  const tick = (): void => {
    if (stopped) return
    analyser.getByteFrequencyData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    const avg = sum / data.length
    const now = performance.now()

    if (avg > energyThreshold) {
      silenceStartedAt = null
      if (!speechActive) {
        speechActive = true
        speechStartedAt = now
        speechConfirmed = false
      }
      if (!speechConfirmed && speechStartedAt !== null && now - speechStartedAt >= minSpeechMs) {
        speechConfirmed = true
        opts.onSpeechStart?.()
      }
    } else if (speechActive) {
      if (silenceStartedAt === null) {
        silenceStartedAt = now
      } else if (now - silenceStartedAt >= silenceEndMs) {
        speechActive = false
        speechStartedAt = null
        silenceStartedAt = null
        if (speechConfirmed) {
          speechConfirmed = false
          opts.onSpeechEnd?.()
        }
      }
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  return {
    stop: () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close()
    },
  }
}
