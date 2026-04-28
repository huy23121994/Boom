import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ConversationTurn, PersistencePreference } from '@/state/conversation'
import {
  _resetQuotaWarningsForTesting,
  clearAll,
  clearPrefs,
  clearTranscript,
  loadPrefs,
  loadTranscript,
  savePrefs,
  saveTranscript,
} from '@/lib/storage'

const turn = (id: string, speaker: 'learner' | 'tutor', text: string): ConversationTurn => ({
  id,
  speaker,
  text,
  timestamp: 1700000000000,
})

const prefs = (overrides: Partial<PersistencePreference> = {}): PersistencePreference => ({
  persistEnabled: false,
  theme: 'system',
  version: 1,
  ...overrides,
})

beforeEach(() => {
  localStorage.clear()
  _resetQuotaWarningsForTesting()
})

describe('loadPrefs', () => {
  it('returns defaults when key absent', () => {
    expect(loadPrefs()).toEqual({ persistEnabled: false, theme: 'system', version: 1 })
  })

  it('returns defaults on unparseable JSON', () => {
    localStorage.setItem('boom:prefs', '{not-json')
    expect(loadPrefs()).toEqual({ persistEnabled: false, theme: 'system', version: 1 })
  })

  it('returns defaults when version is wrong', () => {
    localStorage.setItem('boom:prefs', JSON.stringify({ persistEnabled: true, theme: 'dark', version: 99 }))
    expect(loadPrefs()).toEqual({ persistEnabled: false, theme: 'system', version: 1 })
  })

  it('falls back theme to system on corrupt theme but keeps the rest', () => {
    localStorage.setItem('boom:prefs', JSON.stringify({ persistEnabled: true, theme: 'mauve', version: 1 }))
    expect(loadPrefs()).toEqual({ persistEnabled: true, theme: 'system', version: 1 })
  })

  it('round-trips a valid blob', () => {
    savePrefs(prefs({ persistEnabled: true, theme: 'dark' }))
    expect(loadPrefs()).toEqual({ persistEnabled: true, theme: 'dark', version: 1 })
  })
})

describe('saveTranscript / loadTranscript', () => {
  it('makes ZERO setItem calls when persistEnabled is false (FR-017 / SC-002)', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    saveTranscript([turn('a', 'learner', 'hi')], prefs({ persistEnabled: false }))
    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })

  it('writes when persistEnabled is true and round-trips', () => {
    const turns = [turn('a', 'learner', 'hi'), turn('b', 'tutor', 'hello')]
    saveTranscript(turns, prefs({ persistEnabled: true }))
    expect(loadTranscript()).toEqual(turns)
  })

  it('returns [] on absent key', () => {
    expect(loadTranscript()).toEqual([])
  })

  it('returns [] when version mismatches', () => {
    localStorage.setItem('boom:transcript', JSON.stringify({ turns: [turn('x', 'learner', 'y')], version: 99 }))
    expect(loadTranscript()).toEqual([])
  })

  it('returns [] on unparseable payload', () => {
    localStorage.setItem('boom:transcript', '{garbage')
    expect(loadTranscript()).toEqual([])
  })
})

describe('clearTranscript / clearPrefs / clearAll', () => {
  it('clearTranscript leaves boom:prefs intact (FR-018c)', () => {
    savePrefs(prefs({ persistEnabled: true, theme: 'dark' }))
    saveTranscript([turn('a', 'learner', 'hi')], prefs({ persistEnabled: true }))
    clearTranscript()
    expect(localStorage.getItem('boom:transcript')).toBeNull()
    expect(localStorage.getItem('boom:prefs')).not.toBeNull()
  })

  it('clearPrefs leaves boom:transcript intact', () => {
    savePrefs(prefs({ persistEnabled: true }))
    saveTranscript([turn('a', 'learner', 'hi')], prefs({ persistEnabled: true }))
    clearPrefs()
    expect(localStorage.getItem('boom:prefs')).toBeNull()
    expect(localStorage.getItem('boom:transcript')).not.toBeNull()
  })

  it('clearAll removes both keys (FR-018d)', () => {
    savePrefs(prefs({ persistEnabled: true }))
    saveTranscript([turn('a', 'learner', 'hi')], prefs({ persistEnabled: true }))
    clearAll()
    expect(localStorage.getItem('boom:prefs')).toBeNull()
    expect(localStorage.getItem('boom:transcript')).toBeNull()
  })
})

describe('quota error path', () => {
  it('does not crash if setItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => savePrefs(prefs({ persistEnabled: true }))).not.toThrow()
    expect(() => saveTranscript([turn('a', 'learner', 'hi')], prefs({ persistEnabled: true }))).not.toThrow()
    spy.mockRestore()
    warn.mockRestore()
  })
})
