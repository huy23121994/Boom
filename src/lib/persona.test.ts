import { describe, expect, it } from 'vitest'
import {
  SILENCE_PROMPT_INSTRUCTION,
  SYSTEM_PROMPT,
  buildGreetingMessages,
  buildMessages,
  buildSilencePromptMessages,
} from '@/lib/persona'
import type { ConversationTurn } from '@/state/conversation'

const turn = (
  id: string,
  speaker: 'learner' | 'tutor',
  text: string,
  error?: ConversationTurn['error'],
): ConversationTurn => ({
  id,
  speaker,
  text,
  timestamp: 0,
  ...(error ? { error } : {}),
})

describe('SYSTEM_PROMPT', () => {
  it('mentions warm/casual tutor + correction policy + opener guidance', () => {
    expect(SYSTEM_PROMPT).toMatch(/warm/i)
    expect(SYSTEM_PROMPT).toMatch(/casual/i)
    expect(SYSTEM_PROMPT).toMatch(/correction/i)
    expect(SYSTEM_PROMPT).toMatch(/never formal/i)
  })
})

describe('buildGreetingMessages', () => {
  it('returns only the system prompt (greeting trigger)', () => {
    const msgs = buildGreetingMessages()
    expect(msgs).toHaveLength(1)
    expect(msgs[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT })
  })
})

describe('buildMessages', () => {
  it('always begins with the system prompt', () => {
    const msgs = buildMessages([])
    expect(msgs[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT })
  })

  it('maps learner → user and tutor → assistant', () => {
    const msgs = buildMessages([
      turn('a', 'learner', 'hi'),
      turn('b', 'tutor', 'hello there'),
    ])
    expect(msgs[1]).toEqual({ role: 'user', content: 'hi' })
    expect(msgs[2]).toEqual({ role: 'assistant', content: 'hello there' })
  })

  it('caps the included turns at the most recent 10', () => {
    const turns = Array.from({ length: 15 }, (_, i) =>
      turn(`t${i}`, i % 2 === 0 ? 'learner' : 'tutor', `text ${i}`),
    )
    const msgs = buildMessages(turns)
    expect(msgs).toHaveLength(11)
    expect(msgs[1].content).toBe('text 5')
    expect(msgs[10].content).toBe('text 14')
  })

  it('filters out turns flagged as errors', () => {
    const msgs = buildMessages([
      turn('a', 'learner', 'good'),
      turn('b', 'tutor', 'failed', 'transport'),
      turn('c', 'learner', 'next'),
    ])
    expect(msgs.map((m) => m.content)).toEqual([
      SYSTEM_PROMPT,
      'good',
      'next',
    ])
  })
})

describe('buildSilencePromptMessages', () => {
  it('appends the silence-prompt system instruction after recent turns', () => {
    const msgs = buildSilencePromptMessages([turn('a', 'learner', 'hi')])
    expect(msgs[msgs.length - 1]).toEqual({
      role: 'system',
      content: SILENCE_PROMPT_INSTRUCTION,
    })
  })
})
