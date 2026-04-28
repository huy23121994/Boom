import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  AiProviderError,
  AiTransportError,
  chunkSentences,
  parseSSE,
  sendChatStream,
} from '@/lib/ai'

function makeStreamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

function sseEvent(payload: object): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const v of gen) out.push(v)
  return out
}

async function* fromArray<T>(arr: T[]): AsyncGenerator<T> {
  for (const v of arr) yield v
}

describe('parseSSE', () => {
  it('yields delta.content from each event', async () => {
    const stream = makeStreamFromChunks([
      sseEvent({ choices: [{ delta: { content: 'Hello' }, finish_reason: null }] }),
      sseEvent({ choices: [{ delta: { content: ' world' }, finish_reason: null }] }),
      'data: [DONE]\n\n',
    ])
    const out = await collect(parseSSE(stream))
    expect(out).toEqual(['Hello', ' world'])
  })

  it('terminates on [DONE]', async () => {
    const stream = makeStreamFromChunks([
      sseEvent({ choices: [{ delta: { content: 'a' } }] }),
      'data: [DONE]\n\n',
      sseEvent({ choices: [{ delta: { content: 'b' } }] }),
    ])
    const out = await collect(parseSSE(stream))
    expect(out).toEqual(['a'])
  })

  it('throws AiProviderError on non-stop finish_reason', async () => {
    const stream = makeStreamFromChunks([
      sseEvent({ choices: [{ delta: {}, finish_reason: 'content_filter' }] }),
    ])
    await expect(collect(parseSSE(stream))).rejects.toBeInstanceOf(AiProviderError)
  })

  it('handles event split across multiple chunks', async () => {
    const evt = sseEvent({ choices: [{ delta: { content: 'split' } }] })
    const half = Math.floor(evt.length / 2)
    const stream = makeStreamFromChunks([
      evt.slice(0, half),
      evt.slice(half),
      'data: [DONE]\n\n',
    ])
    const out = await collect(parseSSE(stream))
    expect(out).toEqual(['split'])
  })

  it('ignores malformed JSON lines', async () => {
    const stream = makeStreamFromChunks([
      'data: not-json\n\n',
      sseEvent({ choices: [{ delta: { content: 'good' } }] }),
      'data: [DONE]\n\n',
    ])
    const out = await collect(parseSSE(stream))
    expect(out).toEqual(['good'])
  })
})

describe('chunkSentences', () => {
  it('emits sentence on . followed by whitespace', async () => {
    const out = await collect(chunkSentences(fromArray(['Hello world. ', 'How are'])))
    expect(out).toContain('Hello world.')
  })

  it('emits sentence on ! and ?', async () => {
    const out = await collect(chunkSentences(fromArray(['Wow! ', 'What? ', 'tail'])))
    expect(out).toEqual(['Wow!', 'What?', 'tail'])
  })

  it('emits sentence on …', async () => {
    const out = await collect(chunkSentences(fromArray(['Hmm… ', 'next'])))
    expect(out).toEqual(['Hmm…', 'next'])
  })

  it('yields trailing buffer when stream ends', async () => {
    const out = await collect(chunkSentences(fromArray(['unfinished'])))
    expect(out).toEqual(['unfinished'])
  })

  it('cuts at 200-char hard cap when no terminator', async () => {
    const long = 'x'.repeat(300)
    const out = await collect(chunkSentences(fromArray([long])))
    expect(out[0]).toHaveLength(200)
    expect(out[1]).toHaveLength(100)
  })
})

describe('sendChatStream', () => {
  const realFetch = globalThis.fetch
  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  function mockOk(body: ReadableStream<Uint8Array>): Response {
    return new Response(body, { status: 200, statusText: 'OK' })
  }

  it('streams deltas through to the consumer', async () => {
    const body = makeStreamFromChunks([
      sseEvent({ choices: [{ delta: { content: 'hi' } }] }),
      'data: [DONE]\n\n',
    ])
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockOk(body))
    const out = await collect(sendChatStream([{ role: 'user', content: 'hello' }]))
    expect(out).toEqual(['hi'])
  })

  it('retries once on 5xx then succeeds', async () => {
    const body = makeStreamFromChunks([
      sseEvent({ choices: [{ delta: { content: 'ok' } }] }),
      'data: [DONE]\n\n',
    ])
    ;(globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(mockOk(body))
    const out = await collect(sendChatStream([{ role: 'user', content: 'x' }]))
    expect(out).toEqual(['ok'])
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('throws AiTransportError after second 5xx', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 502 }))
    await expect(
      collect(sendChatStream([{ role: 'user', content: 'x' }])),
    ).rejects.toBeInstanceOf(AiTransportError)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('throws AiProviderError on 4xx without retry', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('', { status: 400 }),
    )
    await expect(
      collect(sendChatStream([{ role: 'user', content: 'x' }])),
    ).rejects.toBeInstanceOf(AiProviderError)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries once on network error then surfaces AiTransportError', async () => {
    ;(globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockRejectedValueOnce(new TypeError('still down'))
    await expect(
      collect(sendChatStream([{ role: 'user', content: 'x' }])),
    ).rejects.toBeInstanceOf(AiTransportError)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })
})
