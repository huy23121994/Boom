import type {
  ConversationTurn,
  PersistencePreference,
  SpeechRate,
  ThemeMode,
} from '@/state/conversation'

const PREFS_KEY = 'boom:prefs'
const TRANSCRIPT_KEY = 'boom:transcript'
const SCHEMA_VERSION = 1

const DEFAULT_PREFS: PersistencePreference = {
  persistEnabled: false,
  theme: 'system',
  speechRate: 'normal',
  version: SCHEMA_VERSION,
}

function isThemeMode(v: unknown): v is ThemeMode {
  return v === 'light' || v === 'dark' || v === 'system'
}

function isSpeechRate(v: unknown): v is SpeechRate {
  return v === 'slow' || v === 'normal' || v === 'fast'
}

let prefsQuotaWarned = false
let transcriptQuotaWarned = false

export function loadPrefs(): PersistencePreference {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw === null) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      (parsed as { version?: unknown }).version !== SCHEMA_VERSION
    ) {
      return { ...DEFAULT_PREFS }
    }
    const obj = parsed as { persistEnabled?: unknown; theme?: unknown; speechRate?: unknown }
    return {
      persistEnabled: typeof obj.persistEnabled === 'boolean' ? obj.persistEnabled : false,
      theme: isThemeMode(obj.theme) ? obj.theme : 'system',
      speechRate: isSpeechRate(obj.speechRate) ? obj.speechRate : 'normal',
      version: SCHEMA_VERSION,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function savePrefs(prefs: PersistencePreference): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    if (!prefsQuotaWarned) {
      console.warn('storage: savePrefs failed (quota or access); ignored')
      prefsQuotaWarned = true
    }
  }
}

export function loadTranscript(): ConversationTurn[] {
  try {
    const raw = localStorage.getItem(TRANSCRIPT_KEY)
    if (raw === null) return []
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      (parsed as { version?: unknown }).version !== SCHEMA_VERSION
    ) {
      return []
    }
    const turns = (parsed as { turns?: unknown }).turns
    return Array.isArray(turns) ? (turns as ConversationTurn[]) : []
  } catch {
    return []
  }
}

export function saveTranscript(
  turns: ConversationTurn[],
  prefs: PersistencePreference,
): void {
  if (prefs.persistEnabled !== true) return
  try {
    localStorage.setItem(
      TRANSCRIPT_KEY,
      JSON.stringify({ turns, version: SCHEMA_VERSION }),
    )
  } catch {
    if (!transcriptQuotaWarned) {
      console.warn('storage: saveTranscript failed (quota or access); ignored')
      transcriptQuotaWarned = true
    }
  }
}

export function clearTranscript(): void {
  localStorage.removeItem(TRANSCRIPT_KEY)
}

export function clearPrefs(): void {
  localStorage.removeItem(PREFS_KEY)
}

export function clearAll(): void {
  clearTranscript()
  clearPrefs()
}
