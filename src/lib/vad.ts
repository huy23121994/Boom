export interface VADCallbacks {
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
}

export interface VADHandle {
  stop: () => void
}

const ENERGY_THRESHOLD = 22
const SILENCE_END_MS = 2200

export async function startVAD(cb: VADCallbacks): Promise<VADHandle> {
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
  let silenceStartedAt: number | null = null
  let stopped = false
  let raf = 0

  const tick = (): void => {
    if (stopped) return
    analyser.getByteFrequencyData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i]
    const avg = sum / data.length

    if (avg > ENERGY_THRESHOLD) {
      if (!speechActive) {
        speechActive = true
        cb.onSpeechStart?.()
      }
      silenceStartedAt = null
    } else if (speechActive) {
      const now = performance.now()
      if (silenceStartedAt === null) {
        silenceStartedAt = now
      } else if (now - silenceStartedAt >= SILENCE_END_MS) {
        speechActive = false
        silenceStartedAt = null
        cb.onSpeechEnd?.()
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
