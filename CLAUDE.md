# Project: Boom — Daily English Tutor

A web-first AI conversation app for daily 1-on-1 spoken English practice. The
AI plays the role of a patient tutor: it converses naturally with the user,
detects grammar/pronunciation mistakes, and offers corrections without
breaking conversational flow. Deployed as a PWA so it can be installed on
iPhone via "Add to Home Screen" without a Mac/Xcode.

## Architecture

### Conversation loop (`src/hooks/useConversationLoop.ts`)
Central orchestrator. Runs: greeting → (listen → process → think → speak) × N.

### Bubble states (`src/state/conversation.ts`)
`listening → processing → thinking → speaking → listening`
- **listening** — mic open, VAD + STT active
- **processing** — VAD detected speech end, STT finalizing
- **thinking** — prompt sent to AI, streaming response
- **speaking** — TTS playing response sentence-by-sentence

### Key modules
| Module | File |
|--------|------|
| AI client | `src/lib/ai.ts` — streaming chat via OpenAI-compatible proxy |
| STT | `src/lib/stt.ts` — Web Speech API, interim + final results |
| TTS | `src/lib/tts.ts` — SpeechSynthesis, configurable rate |
| VAD | `src/lib/vad.ts` — energy-threshold (AudioContext) |
| Persona | `src/lib/persona.ts` — system prompt, 10-turn context window |
| Storage | `src/lib/storage.ts` — localStorage prefs + opt-in transcript |

## Tech stack
- **Frontend:** React 19 + TypeScript + Vite 8
- **Styling:** UnoCSS (`@unocss/preset-wind3`). Design tokens in `uno.config.ts`.
- **State:** Zustand (single store at `src/state/conversation.ts`)
- **AI:** OpenAI-compatible proxy (`VITE_AI_BASE_URL`), model via `VITE_AI_MODEL`
- **STT:** Web Speech API (browser-native)
- **TTS:** Browser SpeechSynthesis API, configurable speech rate
- **VAD:** Energy-threshold over AudioContext.AnalyserNode
- **PWA:** `vite-plugin-pwa`, standalone display

## Conventions
- **No tests** — removed for simplicity, may add later
- **No comments** unless they capture a non-obvious *why*
- **No half-done work** — a change either fully works or is reverted
- **Secrets** never committed — `.env.local` only, `.env.example` has placeholders
- Every code change must build: `npm run build`
