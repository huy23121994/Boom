export interface VADCallbacks {
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
}

export interface VADHandle {
  stop: () => void
}

const ENERGY_THRESHOLD = 25
const SILENCE_FRAMES_TO_END = 75

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
  let silenceCount = 0
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
      silenceCount = 0
    } else if (speechActive) {
      silenceCount++
      if (silenceCount >= SILENCE_FRAMES_TO_END) {
        speechActive = false
        silenceCount = 0
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
