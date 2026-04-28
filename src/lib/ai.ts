import { env } from '@/lib/env'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class AiTransportError extends Error {
  readonly kind = 'transport' as const
  constructor(message: string) {
    super(message)
    this.name = 'AiTransportError'
  }
}

export class AiProviderError extends Error {
  readonly kind = 'provider' as const
  constructor(message: string) {
    super(message)
    this.name = 'AiProviderError'
  }
}

const RETRY_DELAY_MS = 250
const SENTENCE_HARD_CAP = 200

async function fetchOnce(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (res.status >= 500) {
    throw new AiTransportError(`HTTP ${res.status} ${res.statusText}`)
  }
  if (!res.ok) {
    throw new AiProviderError(`HTTP ${res.status} ${res.statusText}`)
  }
  return res
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchOnce(url, init)
  } catch (err) {
    if (err instanceof AiProviderError) throw err
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    try {
      return await fetchOnce(url, init)
    } catch (err2) {
      if (err2 instanceof AiProviderError) throw err2
      if (err2 instanceof AiTransportError) throw err2
      throw new AiTransportError(
        err2 instanceof Error ? err2.message : 'network error',
      )
    }
  }
}

export async function* parseSSE(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let eventEnd: number
      while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
        const event = buffer.slice(0, eventEnd)
        buffer = buffer.slice(eventEnd + 2)
        for (const line of event.split('\n')) {
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (data === '[DONE]') return
          if (data.length === 0) continue
          let parsed: unknown
          try {
            parsed = JSON.parse(data)
          } catch {
            continue
          }
          const choice = (parsed as { choices?: Array<{ delta?: { content?: unknown }; finish_reason?: unknown }> })
            .choices?.[0]
          const finish = choice?.finish_reason
          if (finish !== null && finish !== undefined && finish !== 'stop') {
            throw new AiProviderError(`finish_reason: ${String(finish)}`)
          }
          const delta = choice?.delta?.content
          if (typeof delta === 'string' && delta.length > 0) {
            yield delta
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function* chunkSentences(
  source: AsyncIterable<string>,
): AsyncGenerator<string> {
  let buffer = ''
  for await (const delta of source) {
    buffer += delta
    while (true) {
      const match = buffer.match(/^([\s\S]*?[.!?…])\s/)
      if (match) {
        const sentence = match[1]
        yield sentence
        buffer = buffer.slice(match[0].length)
        continue
      }
      if (buffer.length >= SENTENCE_HARD_CAP) {
        yield buffer.slice(0, SENTENCE_HARD_CAP)
        buffer = buffer.slice(SENTENCE_HARD_CAP)
        continue
      }
      break
    }
  }
  const tail = buffer.trim()
  if (tail.length > 0) yield tail
}

export async function* sendChatStream(
  messages: ChatMessage[],
): AsyncGenerator<string> {
  const url = `${env.baseUrl}/chat/completions`
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.apiKey}`,
    },
    body: JSON.stringify({
      model: env.model,
      stream: true,
      messages,
    }),
  }
  const res = await fetchWithRetry(url, init)
  if (!res.body) {
    throw new AiTransportError('response has no body')
  }
  yield* parseSSE(res.body)
}
