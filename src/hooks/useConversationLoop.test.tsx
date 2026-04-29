import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const aiMocks = {
  sendChatStream: vi.fn(),
  chunkSentences: vi.fn(),
  AiTransportError: class AiTransportError extends Error {
    readonly kind = 'transport' as const
  },
  AiProviderError: class AiProviderError extends Error {
    readonly kind = 'provider' as const
  },
}
vi.mock('@/lib/ai', () => aiMocks)

const sttMocks = {
  startRecognition: vi.fn(),
}
vi.mock('@/lib/stt', () => sttMocks)

const ttsMocks = {
  speak: vi.fn(),
  cancel: vi.fn(),
}
vi.mock('@/lib/tts', () => ttsMocks)

const vadMocks = {
  startVAD: vi.fn(),
}
vi.mock('@/lib/vad', () => vadMocks)

interface VADCallbacks {
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
}

let lastVADCallbacks: VADCallbacks = {}
let lastSTTCallbacks:
  | { onFinalTranscript: (text: string) => void; onError: (e: Error) => void }
  | undefined
const vadStop = vi.fn()
const sttStop = vi.fn()

async function* yieldDeltas(deltas: string[]): AsyncGenerator<string> {
  for (const d of deltas) yield d
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.clearAllMocks()

  lastVADCallbacks = {}
  lastSTTCallbacks = undefined

  vadMocks.startVAD.mockImplementation((cb: VADCallbacks) => {
    lastVADCallbacks = cb
    return Promise.resolve({ stop: vadStop })
  })
  sttMocks.startRecognition.mockImplementation((cb) => {
    lastSTTCallbacks = cb
    return { stop: sttStop }
  })
  ttsMocks.speak.mockImplementation(() => Promise.resolve())
  ttsMocks.cancel.mockImplementation(() => {})
  aiMocks.sendChatStream.mockImplementation(() =>
    yieldDeltas(['Hi! ', 'How are you today?']),
  )
  aiMocks.chunkSentences.mockImplementation(async function* (
    src: AsyncIterable<string>,
  ) {
    let buf = ''
    for await (const d of src) {
      buf += d
      const m = buf.match(/^([\s\S]*?[.!?…])\s/)
      if (m) {
        yield m[1]
        buf = buf.slice(m[0].length)
      }
    }
    if (buf.trim()) yield buf.trim()
  })

  ;(navigator as unknown as { mediaDevices: unknown }).mediaDevices = {
    getUserMedia: vi.fn(() =>
      Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] }),
    ),
  }

  const { useConversationStore } = await import('@/state/conversation')
  useConversationStore.setState({
    turns: [],
    bubbleState: 'thinking',
    activeError: undefined,
    prefs: { persistEnabled: false, theme: 'system', version: 1 },
  })
})

afterEach(() => {
  vi.useRealTimers()
})

async function flushAll(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(0)
  }
}

describe('useConversationLoop — mic permission', () => {
  it('sets mic-denied error when getUserMedia rejects', async () => {
    ;(
      navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new Error('NotAllowedError'))
    const { useConversationLoop } = await import('@/hooks/useConversationLoop')
    const { useConversationStore } = await import('@/state/conversation')
    const { result } = renderHook(() => useConversationLoop())
    act(() => {
      result.current.begin()
    })
    await flushAll()
    expect(useConversationStore.getState().activeError).toBe('mic-denied')
  })
})

describe('useConversationLoop — listening turn endpoints', () => {
  it('VAD onSpeechEnd transitions bubble to thinking and forwards transcript to AI', async () => {
    const { useConversationLoop } = await import('@/hooks/useConversationLoop')
    const { useConversationStore } = await import('@/state/conversation')
    const { result } = renderHook(() => useConversationLoop())
    act(() => {
      result.current.begin()
    })
    await flushAll()
    expect(useConversationStore.getState().bubbleState).toBe('listening')
    act(() => {
      lastSTTCallbacks?.onFinalTranscript('I went to the park yesterday')
      lastVADCallbacks.onSpeechEnd?.()
    })
    await vi.advanceTimersByTimeAsync(500)
    await flushAll()
    expect(aiMocks.sendChatStream).toHaveBeenCalledTimes(2)
    const lastCall = aiMocks.sendChatStream.mock.calls[1][0]
    const learnerMsg = lastCall.find(
      (m: { role: string; content: string }) =>
        m.role === 'user' && m.content === 'I went to the park yesterday',
    )
    expect(learnerMsg).toBeDefined()
  })

  it('endTurnByTap during listening resolves the turn within the same tick', async () => {
    const { useConversationLoop } = await import('@/hooks/useConversationLoop')
    const { useConversationStore } = await import('@/state/conversation')
    const { result } = renderHook(() => useConversationLoop())
    act(() => {
      result.current.begin()
    })
    await flushAll()
    expect(useConversationStore.getState().bubbleState).toBe('listening')
    act(() => {
      lastSTTCallbacks?.onFinalTranscript('hello')
      result.current.endTurnByTap()
    })
    await vi.advanceTimersByTimeAsync(500)
    await flushAll()
    expect(aiMocks.sendChatStream).toHaveBeenCalledTimes(2)
  })

  it('endTurnByTap is a no-op when bubble is not listening', async () => {
    const { useConversationLoop } = await import('@/hooks/useConversationLoop')
    const { useConversationStore } = await import('@/state/conversation')
    const { result } = renderHook(() => useConversationLoop())
    useConversationStore.setState({ bubbleState: 'speaking' })
    act(() => {
      result.current.endTurnByTap()
    })
    await flushAll()
    expect(useConversationStore.getState().bubbleState).toBe('speaking')
  })
})

describe('useConversationLoop — silence policy (FR-021 / SC-010)', () => {
  it('60s silence ends the turn WITHOUT appending any learner turn', async () => {
    const { useConversationLoop } = await import('@/hooks/useConversationLoop')
    const { useConversationStore } = await import('@/state/conversation')
    const { result } = renderHook(() => useConversationLoop())
    act(() => {
      result.current.begin()
    })
    await flushAll()
    const turnsBefore = useConversationStore.getState().turns.length
    expect(useConversationStore.getState().bubbleState).toBe('listening')
    await vi.advanceTimersByTimeAsync(30_000)
    await flushAll()
    await vi.advanceTimersByTimeAsync(30_000)
    await flushAll()
    expect(useConversationStore.getState().turns.length).toBe(turnsBefore)
  })
})

describe('useConversationLoop — max-turn cap (FR-009 / research §15)', () => {
  it('90s wall-clock cap fires while VAD never endpoints', async () => {
    const { useConversationLoop } = await import('@/hooks/useConversationLoop')
    const { useConversationStore } = await import('@/state/conversation')
    const { result } = renderHook(() => useConversationLoop())
    act(() => {
      result.current.begin()
    })
    await flushAll()
    expect(useConversationStore.getState().bubbleState).toBe('listening')
    act(() => {
      lastVADCallbacks.onSpeechStart?.()
      lastSTTCallbacks?.onFinalTranscript('still talking')
    })
    await vi.advanceTimersByTimeAsync(90_000)
    await vi.advanceTimersByTimeAsync(500)
    await flushAll()
    expect(aiMocks.sendChatStream).toHaveBeenCalledTimes(2)
  })
})

describe('useConversationLoop — provider error (FR-020)', () => {
  it('does NOT append a tutor turn when AI throws AiProviderError, loop resumes in listening', async () => {
    aiMocks.sendChatStream.mockImplementationOnce(async function* () {
      throw new aiMocks.AiProviderError('content_filter')
    })
    const { useConversationLoop } = await import('@/hooks/useConversationLoop')
    const { useConversationStore } = await import('@/state/conversation')
    const { result } = renderHook(() => useConversationLoop())
    act(() => {
      result.current.begin()
    })
    await flushAll()
    const turns = useConversationStore.getState().turns
    expect(turns.filter((t) => t.speaker === 'tutor')).toHaveLength(0)
    expect(useConversationStore.getState().bubbleState).toBe('listening')
  })
})

describe('useConversationLoop — stop()', () => {
  it('stop() clears handles and allows begin() to restart cleanly', async () => {
    const { useConversationLoop } = await import('@/hooks/useConversationLoop')
    const { useConversationStore } = await import('@/state/conversation')
    const { result } = renderHook(() => useConversationLoop())
    act(() => {
      result.current.begin()
    })
    await flushAll()
    expect(useConversationStore.getState().bubbleState).toBe('listening')
    act(() => {
      result.current.stop()
    })
    expect(vadStop).toHaveBeenCalled()
    expect(sttStop).toHaveBeenCalled()
    expect(ttsMocks.cancel).toHaveBeenCalled()
    expect(useConversationStore.getState().bubbleState).toBe('thinking')
    act(() => {
      result.current.begin()
    })
    await flushAll()
    expect(useConversationStore.getState().bubbleState).toBe('listening')
  })
})
