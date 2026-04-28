import { create } from 'zustand'
import { applyTheme } from '@/lib/theme'
import {
  clearAll as storageClearAll,
  clearTranscript,
  saveTranscript,
  savePrefs,
} from '@/lib/storage'

export type BubbleState = 'speaking' | 'listening' | 'thinking'

export type ThemeMode = 'light' | 'dark' | 'system'

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
  version: number
}

export interface Conversation {
  turns: ConversationTurn[]
  bubbleState: BubbleState
  activeError: ActiveError
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
}

const DEFAULT_PREFS: PersistencePreference = {
  persistEnabled: false,
  theme: 'system',
  version: 1,
}

const VALID_TRANSITIONS: Record<BubbleState, ReadonlyArray<BubbleState>> = {
  listening: ['thinking'],
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
