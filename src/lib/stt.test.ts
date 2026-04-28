import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startRecognition } from '@/lib/stt'

interface MockRecognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  onresult: ((event: unknown) => void) | null
  onend: ((event: unknown) => void) | null
  onerror: ((event: unknown) => void) | null
}

let lastInstance: MockRecognition | null = null
const constructorSpy = vi.fn()

class MockSpeechRecognition implements MockRecognition {
  lang = ''
  interimResults = false
  continuous = false
  start = vi.fn()
  stop = vi.fn()
  onresult: ((event: unknown) => void) | null = null
  onend: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  constructor() {
    constructorSpy()
    lastInstance = this
  }
}

describe('startRecognition', () => {
  beforeEach(() => {
    lastInstance = null
    constructorSpy.mockClear()
    ;(window as unknown as { webkitSpeechRecognition?: typeof MockSpeechRecognition }).webkitSpeechRecognition =
      MockSpeechRecognition
  })

  afterEach(() => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  })

  it('configures recognizer with en-US, interimResults=true, continuous=false', () => {
    startRecognition({ onFinalTranscript: vi.fn(), onError: vi.fn() })
    expect(lastInstance?.lang).toBe('en-US')
    expect(lastInstance?.interimResults).toBe(true)
    expect(lastInstance?.continuous).toBe(false)
    expect(lastInstance?.start).toHaveBeenCalledTimes(1)
  })

  it('does not surface interim transcripts', () => {
    const onFinal = vi.fn()
    startRecognition({ onFinalTranscript: onFinal, onError: vi.fn() })
    lastInstance?.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: false, 0: { transcript: 'partial' }, length: 1 }],
    })
    expect(onFinal).not.toHaveBeenCalled()
  })

  it('delivers final transcript on stop()', () => {
    const onFinal = vi.fn()
    const handle = startRecognition({ onFinalTranscript: onFinal, onError: vi.fn() })
    lastInstance?.onresult?.({
      resultIndex: 0,
      results: [{ isFinal: true, 0: { transcript: 'hello world' }, length: 1 }],
    })
    handle.stop()
    lastInstance?.onend?.({})
    expect(onFinal).toHaveBeenCalledWith('hello world')
  })

  it('auto-restarts up to 3 times then surfaces an error', () => {
    const onError = vi.fn()
    startRecognition({ onFinalTranscript: vi.fn(), onError })
    expect(lastInstance?.start).toHaveBeenCalledTimes(1)
    lastInstance?.onend?.({})
    expect(lastInstance?.start).toHaveBeenCalledTimes(2)
    lastInstance?.onend?.({})
    expect(lastInstance?.start).toHaveBeenCalledTimes(3)
    lastInstance?.onend?.({})
    expect(lastInstance?.start).toHaveBeenCalledTimes(4)
    lastInstance?.onend?.({})
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
  })

  it('reports an error when SpeechRecognition is unavailable', () => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    const onError = vi.fn()
    startRecognition({ onFinalTranscript: vi.fn(), onError })
    expect(onError).toHaveBeenCalledOnce()
  })
})
