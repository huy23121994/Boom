# Implementation Plan: Voice-First Conversation MVP

**Branch**: `master` (solo MVP — branching optional per constitution) | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `.specify/specs/001-voice-conversation-mvp/spec.md`

## Summary

Boom feature 001 ships a hands-free spoken English conversation loop in the browser. A single centered bubble cycles through three states (`speaking`, `listening`, `thinking`) while a model-generated greeting opens each session, the learner speaks, voice-activity detection (with tap override) ends the turn, transcription feeds an OpenAI-compatible LLM via a streaming proxy, and the streamed reply is sentence-chunked into the browser's speech synthesizer to keep end-to-end turn latency at or below 3 s (constitution §IV). Persistence is opt-in (default OFF, localStorage when ON, never uploaded). Distribution is a PWA with vite-plugin-pwa.

The architectural keystone is **streaming + sentence-chunked TTS**: it is the only path that meets the §IV budget on browser-native STT/TTS, so it is non-negotiable rather than an optimization.

## Technical Context

**Language/Version**: TypeScript ~6.0 on React 19.2 (already scaffolded; preserve `package.json`).
**Primary Dependencies**: Vite 8 (build), `vite-plugin-pwa` (manifest + service worker), `unocss` with `@unocss/preset-wind3` for Tailwind-compatible utility classes plus custom design-token shortcuts (`text-default`, `bg-default`, `border-default`, etc.) declared in root `uno.config.ts`, `zustand` for the single global store. VAD is hand-rolled over `AudioContext.AnalyserNode` (no external lib — see research §5 amendment). No AI SDK dependency — use raw `fetch` against the OpenAI-compatible proxy.
**Storage**: Browser `localStorage` keyed `boom:transcript` and `boom:prefs`. `boom:prefs` is always-persisted (the toggle itself must survive reload); `boom:transcript` is written **only** when `prefs.persistEnabled === true` (FR-017). All transcript writes go through `src/lib/storage.ts`, which no-ops when persistence is OFF. IndexedDB rejected for MVP — payload is small text and the adapter abstracts the choice for a one-file future swap.
**Testing**: Vitest + @testing-library/react for unit/component tests where automatable; manual SC walkthroughs documented in `quickstart.md` for SCs that require real audio I/O. No E2E framework adopted in this feature (YAGNI per §VII).
**Target Platform**: Modern evergreen browsers — iOS Safari (PWA), desktop Chrome/Safari/Firefox. Background-audio support is explicitly out of scope (spec). PWA installable via "Add to Home Screen" per constitution.
**Project Type**: Single-page web application; no backend in this feature beyond the locked AI inference proxy.
**Performance Goals**: Median end-to-end turn latency ≤ 3000 ms (SC-001 / §IV). Budget split: STT ≤ 800 ms, LLM first sentence ≤ 1500 ms, TTS first audio chunk ≤ 700 ms — total 3000 ms with **0 ms theoretical margin**, so streaming + sentence-chunked TTS is mandatory (LLM continues generating while TTS plays the first sentence, recovering the margin in practice).
**Constraints**: Browser-native STT (`webkitSpeechRecognition`) and TTS (`SpeechSynthesis`) only (§VI). No conversation data uploaded anywhere except in flight to the AI proxy (FR-024). No persistence by default (FR-017). No barge-in (FR-007). Bundle should remain small enough for snappy first-paint over typical home connections; the energy-based VAD (research §5, amended 2026-04-28) carries zero external network resources — no large ONNX model download.
**Scale/Scope**: Single-user, single-tab, single-screen feature. Conversation history capped functionally at the most-recent ~10 turns sent to the LLM (assumption from spec); local transcript storage is unbounded but realistically small (text-only).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (no changes).*

| Principle | Verdict | Evidence |
|---|---|---|
| **§I Spec Before Code** | PASS | Every FR/SC is mapped to a module in §"Module ownership matrix" below; no orphan code planned. |
| **§II Two-Reviewer Gate** | PASS | This plan will be sent to `spec-reviewer`; subsequent code edits will be sent to `code-reviewer` per task. |
| **§III Voice-First UX** | PASS | Mic-denied path explicitly forbids text-input fallback (FR-022); no UI surface competes with the bubble during `listening` (FR-026). |
| **§IV Latency Discipline (≤ 3 s, sub-budgets)** | PASS w/ note | Sub-budgets met by design (table below). Theoretical margin is 0 ms; streaming + sentence-chunked TTS is what restores real-world margin. SC-001 tracks median; if p95 deviates >20%, plan revision required (a documented escalation, not a violation). |
| **§V Privacy by Default** | PASS | Default OFF persistence (FR-017, SC-002). Opt-in localStorage only (FR-018b). No server upload of conversation data (FR-024). Service worker explicitly does **not** cache AI requests. |
| **§VI Free-Tier First** | PASS | Browser-native STT + TTS only. Whisper-via-proxy fallback is documented in `research.md` as a contingency gated on measured failure of SC-001, not adopted now. |
| **§VII MVP Discipline (YAGNI)** | PASS w/ note | Two pre-MVP libraries adopted by 2026-04-28 plan amendment: (a) **Zustand** (~1 kB) — the orchestrator hook needs to read/write conversation state without React-tree prop drilling and without a Context+useReducer dance that adds boilerplate without saving cost; Zustand pays for itself the first time the orchestrator dispatches an action; (b) **UnoCSS** (build-time, zero runtime) — dark/light theme + design-token shortcuts (`text-default`, `bg-default`, …) need a utility-class system; UnoCSS preset-wind3 gives Tailwind-class compatibility with smaller bundle and faster HMR than Tailwind itself. No animation library, no E2E test framework, no IndexedDB, no premature abstraction layer for the eventual STT swap beyond the existing module boundary, no logging framework. |

No violations. The Complexity Tracking table at the bottom is therefore empty.

### Module ownership matrix (FRs)

Each FR is owned by **exactly one** module. Reviewer-acceptance criterion #1.

| Module | Owns FRs |
|---|---|
| `src/lib/ai.ts` | FR-003, FR-010, FR-011, FR-013, FR-019, FR-024 |
| `src/lib/stt.ts` | FR-026 (no surfacing of partials) |
| `src/lib/tts.ts` | *(supporting primitive only — no exclusive FR; supports FR-006 via orchestrator)* |
| `src/lib/vad.ts` | *(supporting primitive only — provides the VAD endpoint signal that the orchestrator consumes for FR-009)* |
| `src/lib/storage.ts` | FR-017, FR-018b, FR-018c, FR-018d |
| `src/lib/theme.ts` | *(supporting primitive only — `applyTheme(mode)` toggles the `dark` class on `<html>`, `resolveTheme()` resolves `'system'` via `prefers-color-scheme`, `subscribeSystemTheme()` listens for OS changes; consumed by the Zustand store; no exclusive FR)* |
| `src/state/conversation.ts` (Zustand store) | FR-002, FR-014, FR-015, FR-016 |
| `src/hooks/useConversationLoop.ts` | FR-004, FR-005, FR-006, FR-007, **FR-009** (turn-end policy: VAD-default + tap-override + 90 s max-turn cap per research §15), FR-020, FR-021, FR-027 |
| `src/components/Bubble.tsx` | FR-001, FR-002 (visual), FR-008 |
| `src/components/Transcript.tsx` | FR-014/FR-015/FR-016 (rendering only — invariant lives in state module); FR-018, FR-018a (persistence controls in panel header — amended 2026-04-29) |
| `src/components/ThemeToggle.tsx` | *(no exclusive FR — binary light↔dark toggle; fixed-position button top-right; amended 2026-04-29)* |
| `src/components/MicPermissionError.tsx` | FR-022 |
| `src/App.tsx` | FR-023, FR-025, FR-012 (UI absence enforced by composition) |

> **Note on shared FRs**: FR-002, FR-014, FR-015, FR-016 are *invariants* (e.g., transcript only contains finalized turns; bubble state is exactly one of three). The state module owns the invariant; the view module renders it. Same FR number appears under both, but the *responsibility* is one-owner.
> **Note on supporting primitives**: `tts.ts` and `vad.ts` provide low-level capabilities consumed by the orchestrator. They own no FR by themselves; the orchestrator (`useConversationLoop.ts`) owns the FR that uses the primitive. This keeps "exactly one module per FR" intact and makes the `vad-web` swap (or any TTS swap) a primitive-level change with no FR re-assignment needed.

### SC / FR verification matrix

Reviewer-acceptance criterion #2: every SC, and every FR whose enforcement is not already implied by an SC, has a clear test path.

| SC / FR | What it asserts | Verification path | Auto / Manual |
|---|---|---|---|
| SC-001 | Median end-to-end turn ≤ 3000 ms | `performance.now()` markers in `useConversationLoop.ts`; aggregate over 10 turns in dev console. | Auto (in dev) |
| SC-002 | Zero bytes persisted with toggle OFF | Vitest unit on `storage.ts`: with `prefs.persistEnabled=false`, `saveTranscript()` makes zero `localStorage.setItem` calls; integration check via `localStorage.length`. | Auto |
| SC-003 | 100% restore on reload with toggle ON | Component test: seed transcript via store action → persist → simulate reload → assert store state equality (length, order, timestamps). | Auto |
| SC-004 | Mic stream not active during `speaking` | Orchestrator releases `MediaStream` track on enter-`speaking` and re-acquires on enter-`listening`; unit test asserts `track.readyState === 'ended'` for the duration. | Auto |
| SC-005 | 0 corrections outside natural reply across 20 samples | Manual review of 20 conversation samples driven by `quickstart.md` checklist. | Manual |
| SC-006 | Tap-end-of-turn ≤ 200 ms perceived | `performance.now()` between `pointerdown` and bubble state transition; component test. | Auto |
| SC-007 | Full first-launch loop without non-bubble UI | Manual walkthrough per `quickstart.md`. | Manual |
| SC-008 | Network-drop bubble exits `thinking` ≤ 10 s | Component test mocks `fetch` to hang; orchestrator timeout watchdog asserted. | Auto |
| SC-009 | Greeting varies in ≥80% of 10 cold opens | One-off script in `quickstart.md` calls greeting endpoint 10× and counts uniqueness. | Auto (script) |
| SC-010 | Silence prompt at 30±5 s, end-turn at 60±5 s, 10/10 trials | Component test with fake timers + silent-VAD stub; assert prompt fired and turn ended at the timer thresholds. | Auto |
| SC-011 | Zero STT partial characters in UI | Component test on `stt.ts`: feed simulated interim events and assert no DOM updates in the bubble area; visual confirmation in `quickstart.md`. | Auto + Manual |
| FR-009 (max-turn cap) | Bubble exits `listening` at 90 ± 5 s of continuous capture even when VAD never endpoints | Component test with fake timers + sustained-VAD-speech stub (`onSpeechStart` fires, `onSpeechEnd` never fires); assert transition to `thinking` at the cap and that partial STT transcript captured up to the cap is forwarded to `ai.ts`. See research §15. | Auto |

### Latency budget (§IV)

Reviewer-acceptance criterion #3.

| Stage | Budget | Notes |
|---|---|---|
| STT final after VAD endpoint | ≤ 800 ms | Web Speech API typical. iOS Safari has been observed under 500 ms when network is good. |
| LLM first sentence streamed | ≤ 1500 ms | Gemini 2.5 Flash via proxy; SSE streaming is **mandatory**. First-sentence boundary detected by punctuation in `ai.ts`. |
| TTS first audio chunk | ≤ 700 ms | `SpeechSynthesis.speak()` typically begins audio < 200 ms after `utter` is dispatched on warm voices; budget reserves headroom for first-time voice load. |
| **Total** | **≤ 3000 ms** | Theoretical margin 0 ms; real-world margin recovered by overlapping LLM continuation with TTS-of-first-sentence. |

If real-world p95 exceeds §IV's "20% deviation" threshold (≥ 3600 ms), plan revision is required and Whisper-via-proxy STT becomes a candidate per §VI. This contingency is documented in `research.md`, not adopted now.

## Project Structure

### Documentation (this feature)

```text
.specify/specs/001-voice-conversation-mvp/
├── spec.md                  # WHAT/WHY (frozen, reviewer-approved)
├── plan.md                  # this file
├── research.md              # Phase 0 — decisions, alternatives
├── data-model.md            # Phase 1 — entities, state machine
├── quickstart.md            # Phase 1 — manual SC walkthrough
├── contracts/
│   ├── ai-proxy.md          # OpenAI-compatible chat completions contract we consume
│   └── storage-adapter.md   # internal interface for src/lib/storage.ts
├── checklists/
│   └── requirements.md      # spec quality checklist (reviewer-approved)
└── tasks.md                 # /speckit-tasks output (NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── App.tsx                       # composes layout, owns persona system prompt (FR-025)
├── App.css                       # already present; will be slimmed; only keyframes/global resets here
├── main.tsx                      # already present; imports `@unocss/reset/tailwind.css` + `'virtual:uno.css'`
├── index.css                     # already present; bubble keyframes + dark-class root tokens
├── components/
│   ├── Bubble.tsx                # FR-001/002/008 (view)
│   ├── Transcript.tsx            # FR-014/015/016 (view); FR-018/018a (persistence controls in header)
│   ├── TranscriptToggle.tsx      # fixed top-left button that opens/closes Transcript panel
│   ├── ThemeToggle.tsx           # binary light↔dark toggle; fixed top-right button
│   └── MicPermissionError.tsx    # FR-022
├── hooks/
│   └── useConversationLoop.ts    # orchestrator (consumes the Zustand store via selectors)
├── lib/
│   ├── ai.ts                     # streaming chat completions
│   ├── stt.ts                    # Web Speech API wrapper
│   ├── tts.ts                    # SpeechSynthesis wrapper + sentence chunker
│   ├── vad.ts                    # energy-threshold VAD over AudioContext.AnalyserNode (amended §5)
│   ├── storage.ts                # localStorage adapter, no-ops on OFF
│   └── theme.ts                  # applyTheme(mode) — toggles `dark` on <html>; resolves 'system'
├── state/
│   └── conversation.ts           # Zustand store: types + create() + selectors; no Context, no reducer
└── types/                        # shared d.ts (e.g., webkitSpeechRecognition shim)

public/
├── icon.svg                      # orb icon (SVG source, any size)
├── icon-maskable.svg             # maskable orb icon (SVG, safe-zone padded)
├── icons/
│   ├── 192.png                   # generated from icon.svg via sips (192×192)
│   └── 512.png                   # generated from icon.svg via sips (512×512)
└── (manifest emitted at build time by vite-plugin-pwa)

uno.config.ts                     # UnoCSS preset-wind3 + shortcuts (text-default, bg-default, …)
vite.config.ts                    # path alias @/, vite-plugin-pwa, UnoCSS plugin
tsconfig.app.json                 # path alias @/
.env.example                      # VITE_AI_BASE_URL, VITE_AI_API_KEY, VITE_AI_MODEL
```

**Structure Decision**: Single-project layout (Option 1 from template). Adopted because the feature is one screen, one user, one device, one origin — no backend, no multi-package boundary, no shared library to extract. Splitting into apps/packages would be premature abstraction (§VII).

## Complexity Tracking

> No constitutional violations identified — table empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | — | — |

## Phases

### Phase 0 — Outline & Research → [research.md](./research.md)

Resolves all remaining uncertainty around the locked tech stack: streaming SSE format, sentence-chunking heuristic, iOS Safari STT recovery, energy-threshold VAD (replaces vad-web per §5 amendment), voice selection for SpeechSynthesis, vite-plugin-pwa runtime caching strategy, and the deferred Whisper-via-proxy contingency.

### Phase 1 — Design & Contracts → [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

Captures entity definitions (ConversationTurn, Conversation, BubbleState, PersistencePreference), the bubble state-machine transition table, the consumed AI proxy contract, the internal storage adapter contract, and a manual quickstart that walks through every SC requiring human verification.

### Phase 2 — Tasks (NOT created by this command)

`/speckit-tasks` will turn this plan into an ordered `tasks.md` with `[P]` parallel markers. Reviewer gate runs again.

## Open follow-ups

- None at the spec/plan boundary. All [NEEDS CLARIFICATION] markers were resolved during `/speckit-clarify` on 2026-04-28.
- Bubble color palette deliberately deferred to implementation — picking a hex is not a planning concern.
