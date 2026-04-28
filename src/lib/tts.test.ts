import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { _resetVoiceCacheForTesting, cancel, speak } from '@/lib/tts'

interface MockVoice {
  lang: string
  name: string
}

interface MockUtterance {
  text: string
  voice: MockVoice | null
  rate: number
  pitch: number
  volume: number
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

let lastUtter: MockUtterance | null = null

class MockSpeechSynthesisUtterance implements MockUtterance {
  text: string
  voice: MockVoice | null = null
  rate = 0
  pitch = 0
  volume = 0
  onend: (() => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  constructor(text: string) {
    this.text = text
    lastUtter = this
  }
}

let synthVoices: MockVoice[] = []
const synth = {
  getVoices: vi.fn(() => synthVoices),
  speak: vi.fn(),
  cancel: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

beforeEach(() => {
  _resetVoiceCacheForTesting()
  lastUtter = null
  synthVoices = []
  synth.getVoices.mockClear()
  synth.speak.mockClear()
  synth.cancel.mockClear()
  synth.addEventListener.mockClear()
  synth.removeEventListener.mockClear()
  ;(window as unknown as { speechSynthesis: typeof synth }).speechSynthesis = synth
  ;(globalThis as unknown as { SpeechSynthesisUtterance: typeof MockSpeechSynthesisUtterance }).SpeechSynthesisUtterance =
    MockSpeechSynthesisUtterance
})

afterEach(() => {
  _resetVoiceCacheForTesting()
})

describe('speak — voice selection', () => {
  it('prefers en-US voice with Samantha/Allison/Ava/Joanna/Natural in name', async () => {
    synthVoices = [
      { lang: 'en-GB', name: 'Daniel' },
      { lang: 'en-US', name: 'Alex' },
      { lang: 'en-US', name: 'Samantha' },
      { lang: 'en-US', name: 'Microsoft Aria Online (Natural)' },
    ]
    const promise = speak('hi')
    lastUtter?.onend?.()
    await promise
    expect(lastUtter?.voice?.name).toMatch(/Samantha|Natural/)
    expect(lastUtter?.voice?.lang).toBe('en-US')
  })

  it('falls back to first en-US when no preferred match', async () => {
    synthVoices = [
      { lang: 'en-GB', name: 'Daniel' },
      { lang: 'en-US', name: 'Alex' },
    ]
    const promise = speak('hi')
    lastUtter?.onend?.()
    await promise
    expect(lastUtter?.voice?.name).toBe('Alex')
  })

  it('uses platform default when no en-US voice exists', async () => {
    synthVoices = [{ lang: 'fr-FR', name: 'Thomas' }]
    const promise = speak('hi')
    lastUtter?.onend?.()
    await promise
    expect(lastUtter?.voice).toBeNull()
  })
})

describe('speak — utterance lifecycle', () => {
  it('resolves on onend', async () => {
    synthVoices = [{ lang: 'en-US', name: 'Samantha' }]
    const promise = speak('hello')
    expect(synth.speak).toHaveBeenCalledOnce()
    lastUtter?.onend?.()
    await expect(promise).resolves.toBeUndefined()
  })

  it('rejects on onerror', async () => {
    synthVoices = [{ lang: 'en-US', name: 'Samantha' }]
    const promise = speak('hello')
    lastUtter?.onerror?.({ error: 'synthesis-failed' })
    await expect(promise).rejects.toThrow(/synthesis-failed/)
  })

  it('uses default rate/pitch/volume', async () => {
    synthVoices = [{ lang: 'en-US', name: 'Samantha' }]
    const promise = speak('x')
    lastUtter?.onend?.()
    await promise
    expect(lastUtter?.rate).toBe(1.0)
    expect(lastUtter?.pitch).toBe(1.0)
    expect(lastUtter?.volume).toBe(1.0)
  })
})

describe('cancel', () => {
  it('calls speechSynthesis.cancel', () => {
    cancel()
    expect(synth.cancel).toHaveBeenCalledOnce()
  })
})

describe('voice cache via voiceschanged', () => {
  it('waits for voiceschanged when getVoices() initially returns empty', async () => {
    synthVoices = []
    let voiceschangedHandler: (() => void) | undefined
    synth.addEventListener.mockImplementationOnce((evt, handler) => {
      if (evt === 'voiceschanged') voiceschangedHandler = handler as () => void
    })
    const promise = speak('hi')
    expect(synth.addEventListener).toHaveBeenCalledWith('voiceschanged', expect.any(Function))
    synthVoices = [{ lang: 'en-US', name: 'Samantha' }]
    voiceschangedHandler?.()
    lastUtter?.onend?.()
    await promise
    expect(lastUtter?.voice?.name).toBe('Samantha')
  })
})
