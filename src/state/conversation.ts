import { create } from 'zustand'
import { applyTheme } from '@/lib/theme'
import {
  clearAll as storageClearAll,
  clearTranscript,
  saveTranscript,
  savePrefs,
} from '@/lib/storage'

export type BubbleState = 'speaking' | 'listening' | 'thinking' | 'processing'

export type ThemeMode = 'light' | 'dark' | 'system'

export type SpeechRate = 'slow' | 'normal' | 'fast'

export const SPEECH_RATE_VALUES: Record<SpeechRate, number> = {
  slow: 0.65,
  normal: 0.85,
  fast: 1.0,
}

export type ActiveError = 'mic-denied' | 'transport' | 'provider' | undefined

export interface ConversationTurn {
  id: string
  speaker: 'learner' | 'tutor'
  text: string
  timestamp: number
  error?: 'transport' | 'provider' | 'silence'
}

export interface PersistencePreference {
  persistEnabled: boolean
  theme: ThemeMode
  speechRate: SpeechRate
  voiceName: string | null
  version: number
}

export interface Conversation {
  turns: ConversationTurn[]
  bubbleState: BubbleState
  activeError: ActiveError
  currentSubtitle: string
  interimTranscript: string
}

export interface ConversationStore extends Conversation {
  prefs: PersistencePreference
  boot: (input: {
    persistedTurns?: ConversationTurn[]
    prefs: PersistencePreference
  }) => void
  setBubble: (next: BubbleState) => void
  appendTurn: (turn: ConversationTurn) => void
  setError: (error: ActiveError) => void
  clearAll: () => void
  togglePersist: (next: boolean) => void
  setTheme: (mode: ThemeMode) => void
  setSpeechRate: (rate: SpeechRate) => void
  setVoiceName: (name: string | null) => void
  setSubtitle: (text: string) => void
  setInterimTranscript: (text: string) => void
}

const DEFAULT_PREFS: PersistencePreference = {
  persistEnabled: false,
  theme: 'system',
  speechRate: 'normal',
  voiceName: null,
  version: 1,
}

const VALID_TRANSITIONS: Record<BubbleState, ReadonlyArray<BubbleState>> = {
  listening: ['processing', 'thinking'],
  processing: ['thinking', 'listening'],
  thinking: ['speaking', 'listening'],
  speaking: ['listening'],
}

export function isValidTransition(from: BubbleState, to: BubbleState): boolean {
  if (from === to) return true
  return VALID_TRANSITIONS[from].includes(to)
}

export const useConversationStore = create<ConversationStore>()((set) => ({
  turns: [],
  bubbleState: 'thinking',
  activeError: undefined,
  currentSubtitle: '',
  interimTranscript: '',
  prefs: { ...DEFAULT_PREFS },

  boot: ({ persistedTurns, prefs }) => {
    set({
      turns: persistedTurns ?? [],
      prefs,
      activeError: undefined,
    })
    applyTheme(prefs.theme)
  },

  setBubble: (next) => {
    set((s) => {
      if (!isValidTransition(s.bubbleState, next)) return s
      return { bubbleState: next }
    })
  },

  appendTurn: (turn) => {
    set((s) => {
      const turns = [...s.turns, turn]
      saveTranscript(turns, s.prefs)
      return { turns }
    })
  },

  setError: (error) => {
    set({ activeError: error })
  },

  clearAll: () => {
    set(() => {
      storageClearAll()
      const newPrefs: PersistencePreference = { ...DEFAULT_PREFS }
      savePrefs(newPrefs)
      applyTheme(newPrefs.theme)
      return {
        turns: [],
        prefs: newPrefs,
        activeError: undefined,
        currentSubtitle: '',
        interimTranscript: '',
      }
    })
  },

  togglePersist: (next) => {
    set((s) => {
      const newPrefs: PersistencePreference = { ...s.prefs, persistEnabled: next }
      if (next === false) {
        clearTranscript()
      } else {
        saveTranscript(s.turns, newPrefs)
      }
      savePrefs(newPrefs)
      return { prefs: newPrefs }
    })
  },

  setTheme: (mode) => {
    set((s) => {
      const newPrefs: PersistencePreference = { ...s.prefs, theme: mode }
      applyTheme(mode)
      savePrefs(newPrefs)
      return { prefs: newPrefs }
    })
  },

  setSpeechRate: (rate) => {
    set((s) => {
      const newPrefs: PersistencePreference = { ...s.prefs, speechRate: rate }
      savePrefs(newPrefs)
      return { prefs: newPrefs }
    })
  },

  setVoiceName: (name) => {
    set((s) => {
      const newPrefs: PersistencePreference = { ...s.prefs, voiceName: name }
      savePrefs(newPrefs)
      return { prefs: newPrefs }
    })
  },

  setSubtitle: (text) => {
    set({ currentSubtitle: text })
  },

  setInterimTranscript: (text) => {
    set({ interimTranscript: text })
  },
}))

export const useTurns = (): ConversationTurn[] =>
  useConversationStore((s) => s.turns)
export const useBubbleState = (): BubbleState =>
  useConversationStore((s) => s.bubbleState)
export const usePrefs = (): PersistencePreference =>
  useConversationStore((s) => s.prefs)
export const useTheme = (): ThemeMode =>
  useConversationStore((s) => s.prefs.theme)
export const useError = (): ActiveError =>
  useConversationStore((s) => s.activeError)
export const useSubtitle = (): string =>
  useConversationStore((s) => s.currentSubtitle)
export const useInterimTranscript = (): string =>
  useConversationStore((s) => s.interimTranscript)
