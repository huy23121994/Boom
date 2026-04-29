import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

interface MockAnalyser {
  fftSize: number
  smoothingTimeConstant: number
  frequencyBinCount: number
  getByteFrequencyData: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
}

interface MockSource {
  connect: ReturnType<typeof vi.fn>
}

interface MockCtx {
  createMediaStreamSource: ReturnType<typeof vi.fn>
  createAnalyser: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

let mockAnalyser: MockAnalyser
let mockCtx: MockCtx
let trackStop: ReturnType<typeof vi.fn>
let frameCallbacks: Array<FrameRequestCallback> = []

beforeEach(() => {
  frameCallbacks = []
  mockNow = 0
  vi.spyOn(performance, 'now').mockImplementation(() => mockNow)
  trackStop = vi.fn()
  mockAnalyser = {
    fftSize: 0,
    smoothingTimeConstant: 0,
    frequencyBinCount: 256,
    getByteFrequencyData: vi.fn(),
    connect: vi.fn(),
  }
  const mockSource: MockSource = { connect: vi.fn() }
  mockCtx = {
    createMediaStreamSource: vi.fn(() => mockSource),
    createAnalyser: vi.fn(() => mockAnalyser),
    close: vi.fn(),
  }
  class MockAudioContextCtor {
    constructor() {
      return mockCtx as unknown as MockAudioContextCtor
    }
  }
  ;(globalThis as unknown as { AudioContext: unknown }).AudioContext = MockAudioContextCtor
  ;(window as unknown as { AudioContext: unknown }).AudioContext = MockAudioContextCtor
  ;(navigator as unknown as { mediaDevices: unknown }).mediaDevices = {
    getUserMedia: vi.fn(() =>
      Promise.resolve({
        getTracks: () => [{ stop: trackStop }],
      }),
    ),
  }
  ;(globalThis as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame =
    vi.fn((cb: FrameRequestCallback) => {
      frameCallbacks.push(cb)
      return frameCallbacks.length
    })
  ;(globalThis as unknown as { cancelAnimationFrame: unknown }).cancelAnimationFrame =
    vi.fn()
})

afterEach(() => {
  frameCallbacks = []
})

let mockNow = 0
function tickFrames(n: number, frequencyValue: number, msPerFrame = 16): void {
  for (let i = 0; i < n; i++) {
    mockAnalyser.getByteFrequencyData.mockImplementationOnce((arr: Uint8Array) => {
      arr.fill(frequencyValue)
    })
    mockNow += msPerFrame
    const cb = frameCallbacks.shift()
    cb?.(mockNow)
  }
}

describe('startVAD (energy-based)', () => {
  it('opens mic stream and AudioContext on first call', async () => {
    const { startVAD } = await import('@/lib/vad')
    await startVAD({})
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true })
    expect(mockCtx.createAnalyser).toHaveBeenCalled()
    expect(mockAnalyser.fftSize).toBe(512)
  })

  it('fires onSpeechStart when energy exceeds threshold', async () => {
    const { startVAD } = await import('@/lib/vad')
    const onStart = vi.fn()
    await startVAD({ onSpeechStart: onStart })
    tickFrames(1, 100)
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('fires onSpeechEnd after sustained silence following speech (≥2200ms)', async () => {
    const { startVAD } = await import('@/lib/vad')
    const onEnd = vi.fn()
    await startVAD({ onSpeechEnd: onEnd })
    tickFrames(3, 100)
    expect(onEnd).not.toHaveBeenCalled()
    tickFrames(80, 0)
    expect(onEnd).not.toHaveBeenCalled()
    tickFrames(80, 0)
    expect(onEnd).toHaveBeenCalledOnce()
  })

  it('does not fire onSpeechEnd if speech never started', async () => {
    const { startVAD } = await import('@/lib/vad')
    const onEnd = vi.fn()
    await startVAD({ onSpeechEnd: onEnd })
    tickFrames(200, 0)
    expect(onEnd).not.toHaveBeenCalled()
  })

  it('resets silence timer if speech briefly resumes mid-pause (hesitation)', async () => {
    const { startVAD } = await import('@/lib/vad')
    const onEnd = vi.fn()
    await startVAD({ onSpeechEnd: onEnd })
    tickFrames(3, 100)
    tickFrames(80, 0) // ~1.3s silence — under cap
    expect(onEnd).not.toHaveBeenCalled()
    tickFrames(2, 100) // user resumes speaking
    tickFrames(80, 0) // another ~1.3s silence
    expect(onEnd).not.toHaveBeenCalled() // still under cap each time
    tickFrames(80, 0) // total silence after resume now ~2.5s
    expect(onEnd).toHaveBeenCalledOnce()
  })

  it('stop releases mic tracks and closes AudioContext', async () => {
    const { startVAD } = await import('@/lib/vad')
    const handle = await startVAD({})
    handle.stop()
    expect(trackStop).toHaveBeenCalled()
    expect(mockCtx.close).toHaveBeenCalled()
  })
})
