import { useEffect, useRef } from 'react'
import {
  AiProviderError,
  chunkSentences,
  sendChatStream,
} from '@/lib/ai'
import { startRecognition, type STTHandle } from '@/lib/stt'
import { cancel as ttsCancel, speak } from '@/lib/tts'
import { startVAD, type VADHandle } from '@/lib/vad'
import {
  buildGreetingMessages,
  buildMessages,
  buildSilencePromptMessages,
} from '@/lib/persona'
import {
  SPEECH_RATE_VALUES,
  useConversationStore,
  type ConversationTurn,
} from '@/state/conversation'

const SILENCE_PROMPT_MS = 30_000
const SILENCE_END_MS = 60_000
const MAX_TURN_MS = 90_000
const THINKING_WATCHDOG_MS = 10_000
const HESITATION_WINDOW_MS = 1500

interface RuntimeRefs {
  stopped: boolean
  interrupted: boolean
  vadHandle: VADHandle | null
  sttHandle: STTHandle | null
  finalTranscript: string
  silencePromptTimer: ReturnType<typeof setTimeout> | null
  silenceEndTimer: ReturnType<typeof setTimeout> | null
  maxTurnTimer: ReturnType<typeof setTimeout> | null
  thinkingWatchdogTimer: ReturnType<typeof setTimeout> | null
  hesitationTimer: ReturnType<typeof setTimeout> | null
  resolveTurnEnd: ((reason: TurnEndReason) => void) | null
  perfMarks: { vadEnd?: number; sttFinal?: number; aiFirstToken?: number }
}

type TurnEndReason =
  | 'vad'
  | 'tap'
  | 'max-turn'
  | 'silence-prompt'
  | 'silence-end'
  | 'stopped'
  | 'vad-failed'
  | 'preview'

function clearTimer(t: ReturnType<typeof setTimeout> | null): null {
  if (t !== null) clearTimeout(t)
  return null
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function looksLikeHesitation(text: string): boolean {
  const words = text.trim().split(/\s+/)
  if (words.length === 0 || (words.length === 1 && words[0] === '')) return true
  const last = words[words.length - 1].toLowerCase()
  const fillers = ['uh', 'um', 'hmm', 'er', 'ah']
  return fillers.includes(last)
}

async function probeMic(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    console.error('[boom] probeMic: mediaDevices.getUserMedia not available')
    return false
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch (err) {
    console.error('[boom] probeMic failed:', err)
    return false
  }
}

function getSpeechRate(): number {
  const rate = useConversationStore.getState().prefs.speechRate
  return SPEECH_RATE_VALUES[rate]
}

async function streamAndSpeak(messages: ReturnType<typeof buildMessages>, refs: RuntimeRefs): Promise<string> {
  let firstToken = true
  let fullText = ''
  const rate = getSpeechRate()

  const collect = async function* () {
    for await (const delta of sendChatStream(messages)) {
      if (refs.stopped || refs.interrupted) return
      if (firstToken) {
        firstToken = false
        refs.perfMarks.aiFirstToken = performance.now()
        if (refs.thinkingWatchdogTimer !== null) {
          clearTimeout(refs.thinkingWatchdogTimer)
          refs.thinkingWatchdogTimer = null
        }
      }
      fullText += delta
      yield delta
    }
  }

  let firstSentence = true
  for await (const sentence of chunkSentences(collect())) {
    if (refs.stopped || refs.interrupted) break
    if (firstSentence) {
      firstSentence = false
      const store = useConversationStore.getState()
      if (store.bubbleState === 'thinking') {
        store.setBubble('speaking')
      }
    }
    useConversationStore.getState().setSubtitle(sentence)
    await speak(sentence, rate)
    if (refs.interrupted) break
  }
  return fullText.trim()
}

function logTurnPerf(refs: RuntimeRefs, ttsFirstAudio: number): void {
  const { vadEnd, sttFinal, aiFirstToken } = refs.perfMarks
  if (vadEnd === undefined || sttFinal === undefined || aiFirstToken === undefined) return
  const sttMs = Math.round(sttFinal - vadEnd)
  const llmMs = Math.round(aiFirstToken - sttFinal)
  const ttsMs = Math.round(ttsFirstAudio - aiFirstToken)
  const total = Math.round(ttsFirstAudio - vadEnd)

  console.info(`[turn-perf] vad-end → stt-final: ${sttMs} ms`)
  console.info(`[turn-perf] stt-final → ai-first-token: ${llmMs} ms`)
  console.info(`[turn-perf] ai-first-sentence → tts-first-audio: ${ttsMs} ms`)
  console.info(`[turn-perf] vad-end → tts-first-audio (TOTAL): ${total} ms`)
}

async function runGreeting(refs: RuntimeRefs): Promise<void> {
  const store = useConversationStore.getState()
  store.setError(undefined)
  if (store.bubbleState === 'listening') {
    store.setBubble('thinking')
  }
  refs.thinkingWatchdogTimer = setTimeout(() => {
    if (refs.stopped) return
    useConversationStore.getState().setError('transport')
  }, THINKING_WATCHDOG_MS)

  refs.interrupted = false

  try {
    const text = await streamAndSpeak(buildGreetingMessages(), refs)
    if (text.length > 0) {
      const turn: ConversationTurn = {
        id: makeId(),
        speaker: 'tutor',
        text,
        timestamp: Date.now(),
      }
      useConversationStore.getState().appendTurn(turn)
    }
  } catch (err) {
    handleAiError(err)
  } finally {
    refs.thinkingWatchdogTimer = clearTimer(refs.thinkingWatchdogTimer)
  }
}

function handleAiError(err: unknown): void {
  console.error('[boom] AI request failed:', err)
  const store = useConversationStore.getState()
  if (err instanceof AiProviderError) {
    store.setError('provider')
  } else {
    store.setError('transport')
  }
}

async function runSilencePrompt(refs: RuntimeRefs): Promise<void> {
  const store = useConversationStore.getState()
  if (store.bubbleState === 'listening') {
    store.setBubble('thinking')
  }
  refs.interrupted = false
  try {
    await streamAndSpeak(buildSilencePromptMessages(store.turns), refs)
  } catch (err) {
    handleAiError(err)
  }
}

async function runListenTurn(refs: RuntimeRefs): Promise<void> {
  const store = useConversationStore.getState()
  if (store.bubbleState !== 'listening') {
    store.setBubble('listening')
  }
  store.setError(undefined)
  store.setInterimTranscript('')
  refs.finalTranscript = ''
  refs.perfMarks = {}
  refs.interrupted = false

  const reason = await new Promise<TurnEndReason>((resolve) => {
    refs.resolveTurnEnd = resolve
    void startVAD({
      onSpeechStart: () => {
        refs.silencePromptTimer = clearTimer(refs.silencePromptTimer)
        refs.silenceEndTimer = clearTimer(refs.silenceEndTimer)
      },
      onSpeechEnd: () => {
        if (refs.stopped) return
        refs.perfMarks.vadEnd = performance.now()

        const currentText = refs.finalTranscript.trim()
        if (looksLikeHesitation(currentText)) {
          refs.hesitationTimer = setTimeout(() => {
            refs.resolveTurnEnd?.('vad')
          }, HESITATION_WINDOW_MS)
        } else {
          refs.resolveTurnEnd?.('vad')
        }
      },
    }).then((handle) => {
      if (refs.stopped) {
        handle.stop()
        return
      }
      refs.vadHandle = handle
      refs.sttHandle = startRecognition({
        onFinalTranscript: (text) => {
          refs.finalTranscript = text
          refs.perfMarks.sttFinal = performance.now()
        },
        onInterimTranscript: (text) => {
          useConversationStore.getState().setInterimTranscript(text)
          if (refs.hesitationTimer !== null) {
            refs.hesitationTimer = clearTimer(refs.hesitationTimer)
          }
        },
        onError: () => {},
      })
      refs.silencePromptTimer = setTimeout(() => {
        refs.resolveTurnEnd?.('silence-prompt')
      }, SILENCE_PROMPT_MS)
      refs.silenceEndTimer = setTimeout(() => {
        refs.resolveTurnEnd?.('silence-end')
      }, SILENCE_END_MS)
      refs.maxTurnTimer = setTimeout(() => {
        if (refs.perfMarks.vadEnd === undefined) {
          refs.perfMarks.vadEnd = performance.now()
        }
        refs.resolveTurnEnd?.('max-turn')
      }, MAX_TURN_MS)
    }).catch((err: unknown) => {
      console.error('[boom] VAD failed to start:', err)
      useConversationStore.getState().setError('transport')
      resolve('vad-failed')
    })
  })

  refs.resolveTurnEnd = null
  refs.silencePromptTimer = clearTimer(refs.silencePromptTimer)
  refs.silenceEndTimer = clearTimer(refs.silenceEndTimer)
  refs.maxTurnTimer = clearTimer(refs.maxTurnTimer)
  refs.hesitationTimer = clearTimer(refs.hesitationTimer)
  refs.vadHandle?.stop()
  refs.vadHandle = null

  if (reason === 'stopped') return

  if (reason === 'vad-failed') {
    refs.stopped = true
    return
  }

  if (reason === 'preview') {
    void refs.sttHandle?.stop()
    refs.sttHandle = null
    useConversationStore.getState().setInterimTranscript('')
    return
  }

  if (reason === 'silence-prompt') {
    void refs.sttHandle?.stop()
    refs.sttHandle = null
    useConversationStore.getState().setInterimTranscript('')
    await runSilencePrompt(refs)
    return
  }

  if (reason === 'silence-end') {
    void refs.sttHandle?.stop()
    refs.sttHandle = null
    useConversationStore.getState().setInterimTranscript('')
    return
  }

  useConversationStore.getState().setBubble('processing')

  const interimSnapshot = useConversationStore.getState().interimTranscript
  const sttStop = refs.sttHandle?.stop()
  refs.sttHandle = null
  if (sttStop) await sttStop

  let finalText = refs.finalTranscript.trim()
  if (finalText.length === 0) {
    finalText = interimSnapshot.trim()
  }
  useConversationStore.getState().setInterimTranscript('')

  if (finalText.length === 0) {
    return
  }
  if (refs.perfMarks.sttFinal === undefined) {
    refs.perfMarks.sttFinal = performance.now()
  }

  const learnerTurn: ConversationTurn = {
    id: makeId(),
    speaker: 'learner',
    text: finalText,
    timestamp: Date.now(),
  }
  const storeNow = useConversationStore.getState()
  storeNow.appendTurn(learnerTurn)
  storeNow.setSubtitle('')
  storeNow.setBubble('thinking')

  refs.thinkingWatchdogTimer = setTimeout(() => {
    if (refs.stopped) return
    useConversationStore.getState().setError('transport')
    useConversationStore.getState().setBubble('listening')
    refs.resolveTurnEnd?.('stopped')
  }, THINKING_WATCHDOG_MS)

  refs.interrupted = false

  const ttsFirstAudio = performance.now()
  try {
    const replyText = await streamAndSpeak(
      buildMessages(useConversationStore.getState().turns),
      refs,
    )
    if (replyText.length > 0) {
      const tutorTurn: ConversationTurn = {
        id: makeId(),
        speaker: 'tutor',
        text: replyText,
        timestamp: Date.now(),
      }
      useConversationStore.getState().appendTurn(tutorTurn)
    }
    logTurnPerf(refs, ttsFirstAudio)
  } catch (err) {
    handleAiError(err)
    const errStore = useConversationStore.getState()
    if (errStore.bubbleState !== 'listening') {
      errStore.setBubble('listening')
    }
  } finally {
    refs.thinkingWatchdogTimer = clearTimer(refs.thinkingWatchdogTimer)
  }
}

async function runLoop(refs: RuntimeRefs): Promise<void> {
  const granted = await probeMic()
  if (refs.stopped) return
  if (!granted) {
    useConversationStore.getState().setError('mic-denied')
    return
  }

  await runGreeting(refs)
  if (refs.stopped) return

  while (!refs.stopped) {
    await runListenTurn(refs)
  }
}

export interface UseConversationLoop {
  begin: () => void
  stop: () => void
  endTurnByTap: () => void
  interruptSpeaking: () => void
  pauseMic: () => void
  resumeMic: () => void
  retryAfterMicError: () => Promise<void>
}

export function useConversationLoop(): UseConversationLoop {
  const refs = useRef<RuntimeRefs>({
    stopped: false,
    interrupted: false,
    vadHandle: null,
    sttHandle: null,
    finalTranscript: '',
    silencePromptTimer: null,
    silenceEndTimer: null,
    maxTurnTimer: null,
    thinkingWatchdogTimer: null,
    hesitationTimer: null,
    resolveTurnEnd: null,
    perfMarks: {},
  })
  const startedRef = useRef(false)

  useEffect(() => {
    const r = refs.current
    return () => {
      r.stopped = true
      r.silencePromptTimer = clearTimer(r.silencePromptTimer)
      r.silenceEndTimer = clearTimer(r.silenceEndTimer)
      r.maxTurnTimer = clearTimer(r.maxTurnTimer)
      r.thinkingWatchdogTimer = clearTimer(r.thinkingWatchdogTimer)
      r.hesitationTimer = clearTimer(r.hesitationTimer)
      r.vadHandle?.stop()
      void r.sttHandle?.stop()
      ttsCancel()
      r.resolveTurnEnd?.('stopped')
    }
  }, [])

  return {
    begin: () => {
      if (startedRef.current) return
      startedRef.current = true
      refs.current.stopped = false
      void runLoop(refs.current)
    },
    stop: () => {
      const r = refs.current
      r.stopped = true
      r.silencePromptTimer = clearTimer(r.silencePromptTimer)
      r.silenceEndTimer = clearTimer(r.silenceEndTimer)
      r.maxTurnTimer = clearTimer(r.maxTurnTimer)
      r.thinkingWatchdogTimer = clearTimer(r.thinkingWatchdogTimer)
      r.hesitationTimer = clearTimer(r.hesitationTimer)
      r.vadHandle?.stop()
      r.vadHandle = null
      void r.sttHandle?.stop()
      r.sttHandle = null
      ttsCancel()
      r.resolveTurnEnd?.('stopped')
      startedRef.current = false
      useConversationStore.setState({
        bubbleState: 'thinking',
        activeError: undefined,
        currentSubtitle: '',
        interimTranscript: '',
      })
    },
    endTurnByTap: () => {
      const store = useConversationStore.getState()
      if (store.bubbleState !== 'listening') return
      refs.current.perfMarks.vadEnd = performance.now()
      refs.current.hesitationTimer = clearTimer(refs.current.hesitationTimer)
      refs.current.resolveTurnEnd?.('tap')
    },
    interruptSpeaking: () => {
      const store = useConversationStore.getState()
      if (store.bubbleState !== 'speaking') return
      refs.current.interrupted = true
      ttsCancel()
      store.setSubtitle('')
    },
    pauseMic: () => {
      const r = refs.current
      r.vadHandle?.stop()
      r.vadHandle = null
      void r.sttHandle?.stop()
      r.sttHandle = null
      r.silencePromptTimer = clearTimer(r.silencePromptTimer)
      r.silenceEndTimer = clearTimer(r.silenceEndTimer)
      r.maxTurnTimer = clearTimer(r.maxTurnTimer)
      r.hesitationTimer = clearTimer(r.hesitationTimer)
    },
    resumeMic: () => {
      refs.current.resolveTurnEnd?.('preview')
    },
    retryAfterMicError: async () => {
      const granted = await probeMic()
      if (granted) {
        useConversationStore.getState().setError(undefined)
        refs.current.stopped = false
        void runLoop(refs.current)
      }
    },
  }
}
