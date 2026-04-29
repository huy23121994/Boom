---
description: "Task list for feature 001 — Voice-First Conversation MVP"
---

# Tasks: Voice-First Conversation MVP

**Input**: Design documents from `.specify/specs/001-voice-conversation-mvp/`
**Prerequisites**: spec.md (APPROVED 2026-04-28), plan.md (APPROVED 2026-04-28), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are required for every primitive lib, the Zustand store, the orchestrator, and every component. The constitution's two-reviewer gate (§II) applies after every code-changing task — `code-reviewer` MUST return APPROVED before the task box is checked.

**Organization**: Layered phase ordering (Phase 0 setup → Phase 1 primitive libs → Phase 2 state + orchestrator → Phase 3 view components → Phase 4 composition → Phase 5 verification → Phase 6 PWA polish), per the explicit direction supplied with the `/speckit-tasks` invocation. User-story tags (`[US1]`–`[US4]`) appear on tasks that map to one of the four user stories from `spec.md`; tasks that span all stories carry no story tag.

## Format: `[ID] [P?] [Story?] Description with file path → acceptance check`

- **[P]**: Can run in parallel — disjoint file set, no dependency on a not-yet-completed task.
- **[USn]**: Maps the task to user story `n` from `spec.md` for traceability. Setup, foundational, and PWA-polish tasks have no story tag.
- **Acceptance check**: explicit FR/SC the task closes plus the verification path (auto test, manual walkthrough, etc.).
- **blockedBy**: explicit predecessors when ordering matters.

## Path conventions

Single-project layout per `plan.md` § "Project Structure". All source under `src/`; tests live next to the file as `*.test.ts(x)`. Scripts under `scripts/`. PWA assets under `public/`.

---

## Phase 0 — Setup (sequential)

**Purpose**: Wire the build, the test runner, the PWA plugin, and the env-var validation. Everything in Phase 1+ depends on these. No `[P]` — each task touches shared config the next one needs.

- [x] T001 Configure path alias `@/` → `src/` in `vite.config.ts` and `tsconfig.app.json`. Acceptance: importing `@/lib/foo` resolves in both the Vite dev server and the TypeScript compiler. Verified: `src/main.tsx` switched to `import App from '@/App.tsx'` (live use, not throwaway); `npm run build` succeeded. blockedBy: — — code-reviewer APPROVED 2026-04-28
- [x] T002 Install Vitest + `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` as devDependencies; add `vitest.config.ts` (jsdom env, path alias mirrored from T001); add `"test": "vitest"` script to `package.json`. Acceptance: `npm test` runs zero passing tests cleanly (no failures, no config errors). Verified: `npm test -- --run` exits 0 with "No test files found." blockedBy: T001 — code-reviewer APPROVED 2026-04-28
- [x] T003 Install `vite-plugin-pwa`; scaffold the plugin in `vite.config.ts` with `registerType: 'autoUpdate'` and a minimal `manifest` stub (`name`, `short_name`, `display: 'standalone'`). Detailed icons/runtime-caching are deferred to T022. Acceptance: `npm run build` emits `dist/manifest.webmanifest` and `dist/sw.js`. Verified: build emits both plus `dist/workbox-*.js`. Carries an interim `.npmrc` with `legacy-peer-deps=true` for the vite-8 peer-range lag (research §6 footnote). blockedBy: T001 — code-reviewer APPROVED 2026-04-28
- [x] T004 Create `.env.example` with `VITE_AI_BASE_URL`, `VITE_AI_API_KEY`, `VITE_AI_MODEL` (per `contracts/ai-proxy.md`); confirm `.env` is gitignored; add a tiny `src/lib/env.ts` that reads `import.meta.env.VITE_AI_*`, throws a descriptive error in dev if any required key is missing, and exports a typed `env` object consumed by `ai.ts`. Acceptance: removing `VITE_AI_API_KEY` from a local `.env` causes `import('@/lib/env')` to throw with a message naming the missing key; restoring it makes the import succeed. Verified by inspection: eager `readEnv()` collects all missing keys and throws naming each. `src/vite-env.d.ts` augments `ImportMetaEnv` (no top-level import/export so the augmentation is global). blockedBy: T001 — code-reviewer APPROVED 2026-04-28

### Phase 0 amendment (2026-04-28: styling + global store)

Two additional setup tasks were added when the project owner amended the plan to adopt UnoCSS and Zustand. These are sequential with each other but parallel-safe with Phase 1 once both finish (no shared file with Phase 1 primitives).

- [x] T025 Install `unocss` + `@unocss/preset-wind3` + `@unocss/reset` as devDependencies. Create `uno.config.ts` at the repo root with `presetWind3()` and a `shortcuts` block providing the design-token classes from research §16. Add `UnoCSS()` plugin to `vite.config.ts` (BEFORE `react()`). In `src/main.tsx` add `import '@unocss/reset/tailwind.css'` and `import 'virtual:uno.css'`. Acceptance: `npm run build` passes; `dist/assets/index-*.css` contains `.bg-default { background-color: rgb(255 255 255) }` + `.dark .bg-default { ... rgb(3 7 18) }`, plus `.text-default`/`.dark .text-default` and `.min-h-screen`. App.tsx wrapped in `<div className="bg-default text-default min-h-screen">` to provide live class usage. blockedBy: T001, T003 — code-reviewer APPROVED 2026-04-28
- [x] T026 Install `zustand` as a runtime dependency. Acceptance: `npm ls zustand` reports `zustand@5.0.12` with no peer warnings. blockedBy: T001 — code-reviewer APPROVED 2026-04-28

---

## Phase 1 — Primitive libs (parallel-safe)

**Purpose**: Build the five low-level capabilities the orchestrator composes. Each file is independent of the others; tests ship with the file (Two-Reviewer Gate per module).

- [x] T005 [P] [US1] Implement `src/lib/ai.ts` (`sendChatStream(messages, opts)` async iterable; SSE parser for OpenAI-compatible deltas; sentence-chunking helper; single 250 ms retry on network/5xx; typed `AiTransportError`/`AiProviderError`) plus `src/lib/ai.test.ts` (mock `fetch` returning a chunked `ReadableStream`; assert sentence emission on `.`/`!`/`?`/`…` boundaries and 200-char hard cut; assert single retry on transient error then throw on second; assert `[DONE]` terminates iteration). Acceptance: FR-003, FR-010, FR-011, FR-013, FR-019, FR-024 closed by tests; matches `contracts/ai-proxy.md`. blockedBy: T002, T004
- [x] T006 [P] [US1] Implement `src/lib/stt.ts` (`startRecognition() / stopRecognition()` over `webkitSpeechRecognition` with `lang='en-US'`, `interimResults=true`, `continuous=false`; auto-restart up to 3 consecutive `onend`s within a turn; **never surface interim text**) plus `src/lib/stt.test.ts` (stub `webkitSpeechRecognition`; assert auto-restart fires up to 3× then surfaces error; assert no DOM mutation occurs from interim events; assert final transcript is the only externally-visible output). Acceptance: FR-026 + SC-011 (auto leg) closed; matches research §3. blockedBy: T002
- [x] T007 [P] [US1] Implement `src/lib/tts.ts` (`speak(text)` returning `Promise<void>` resolved on utterance end; `cancel()`; voice selection cached via `onvoiceschanged` per research §4; queue back-to-back utterances with no gap) plus `src/lib/tts.test.ts` (stub `SpeechSynthesis`; assert preferred-voice selection order; assert `cancel()` aborts in-flight + clears the queue; assert `speak()` resolves on `onend`). Acceptance: supports FR-006 via the orchestrator; matches research §4. blockedBy: T002
- [x] T008 [P] [US1] *(implementation amended 2026-04-28 — energy-threshold VAD replaces vad-web; constants refined 2026-04-29; see note)* Implement `src/lib/vad.ts`: `startVAD(callbacks)` starts an `AudioContext.AnalyserNode` frame loop (`fftSize=512`, `smoothingTimeConstant=0.5`); average frequency-bin amplitude above `ENERGY_THRESHOLD=22` counts as speech; `SILENCE_END_MS=2200` ms of continuous below-threshold (measured via `performance.now()`) after speech fires `onSpeechEnd`; returns handle with `stop()` that stops the mic track and closes the AudioContext. Zero external dependencies. Plus `src/lib/vad.test.ts` (mock `AudioContext` + `AnalyserNode`; assert `onSpeechStart` fires when energy crosses threshold; assert `onSpeechEnd` fires after `SILENCE_END_MS` of below-threshold; assert `stop()` closes the context). Acceptance: provides the VAD endpoint signal the orchestrator uses for FR-009; matches research §5 (amended 2026-04-28, constants refined 2026-04-29). *(Original task described `@ricky0123/vad-web` MicVAD — replaced after measured Vite 8/rolldown CJS incompatibility; 2200 ms silence window chosen over the original ~600 ms to prevent premature endpoint on hesitant speech.)* blockedBy: T002
- [x] T009 [P] [US4] Implement `src/lib/storage.ts` per `contracts/storage-adapter.md` (`loadPrefs / savePrefs / loadTranscript / saveTranscript / clearTranscript / clearPrefs / clearAll`). `saveTranscript` MUST no-op when `prefs.persistEnabled !== true`. **PersistencePreference now carries a `theme: 'light' | 'dark' | 'system'` field** (data-model.md, research §17): `loadPrefs()` returns `{ persistEnabled: false, theme: 'system', version: 1 }` on absent/corrupt; if `theme` is missing or not in the allowed set, fall back to `'system'` for that field while keeping the rest. Also implement `src/lib/theme.ts` per research §17: `applyTheme(mode)` toggles `dark` class on `<html>`, `resolveTheme(mode)` resolves `'system'` via `prefers-color-scheme`, `subscribeSystemTheme(cb)` listens on the media query and unsubscribes on cleanup. Plus `src/lib/storage.test.ts` (cases from contract test-cases table: zero `setItem` calls when OFF; round-trip when ON including theme; `clearTranscript` leaves `boom:prefs` intact; `clearAll` removes both keys; quota-error does not crash; corrupt `theme` falls back to `'system'`) and `src/lib/theme.test.ts` (`applyTheme('dark')` adds `dark` to `<html>.classList`; `applyTheme('light')` removes it; `applyTheme('system')` consults `matchMedia` mock; `subscribeSystemTheme` returns an unsubscribe). Acceptance: FR-017, FR-018b, FR-018c, FR-018d closed by tests; SC-002 (storage leg) and SC-003 (storage leg) closed; theme persistence and `applyTheme` round-trip covered. blockedBy: T002. (Note: `src/lib/storage.ts` and `src/lib/theme.ts` import only TS types from `src/state/conversation.ts` and do not require Zustand at runtime. Tests mock the prefs shape directly. T026 is therefore not a predecessor; T010 — the Zustand store — depends on T009, not the other way around.)

> **Checkpoint after Phase 1**: All five primitives pass their unit tests; `code-reviewer` returned APPROVED on each task.

---

## Phase 2 — State + orchestrator (sequential)

**Purpose**: Build the typed Zustand store that owns the conversation invariants and the orchestrator hook that drives the turn lifecycle.

- [x] T010 [US1] Implement `src/state/conversation.ts` per `data-model.md` as a **Zustand store** (research §7, amended): types (`ConversationTurn`, `Conversation`, `BubbleState`, `PersistencePreference` with `theme` field), `create<ConversationStore>()` exposing the closed action set as setters (`boot`, `setBubble`, `appendTurn`, `setError`, `clearAll`, `togglePersist`, `setTheme`). Export `useConversationStore` plus selector hooks: `useTurns`, `useBubbleState`, `usePrefs`, `useTheme`. **No Context provider, no `useReducer`.** Subscribe internally so `prefs.theme` changes trigger `applyTheme(theme)` from `@/lib/theme`, and so prefs/transcript changes call `storage.savePrefs(...)` / `storage.saveTranscript(...)` per the trigger-path matrix in `contracts/storage-adapter.md`. The orchestrator hook is the only caller that issues lifecycle actions (`setBubble`, `appendTurn`, `setError`); UI components dispatch only `togglePersist`, `clearAll`, `setTheme`. Plus `src/state/conversation.test.ts` covering: every state transition listed in the data-model state-transition table is reachable; forbidden transitions (lstn→spk direct, spk→thk, tap-from-spk/thk) are rejected; `boot` hydrates from persisted blob (incl. theme); `clearAll` empties turns and resets prefs to default; `togglePersist(true→false)` calls `storage.clearTranscript()` then `storage.savePrefs(...)` in that order (mock storage adapter); `setTheme('dark')` calls `applyTheme('dark')` then `storage.savePrefs(...)` (mock theme module + storage adapter); selectors return granular slices (changing `turns` does not re-fire a `useTheme` subscriber). Acceptance: FR-002, FR-014, FR-015, FR-016 invariants enforced (transcript only contains finalized turns; bubble state is one of three values; appended turn never empty unless tutor-error placeholder); theme application and persistence round-trips through the store. blockedBy: T009, T026
- [ ] T011 [US1] *(implementation done 2026-04-28; orchestrator-level auto tests for SC-006/SC-004/SC-008/SC-010 + 90 s max-turn cap are deferred to a follow-up review pass per code-reviewer pass-2 ruling — box stays UNCHECKED until those tests land)* Implement `src/hooks/useConversationLoop.ts`: single owner of greeting → listening → VAD/tap end → STT finalize → AI streaming → TTS chunked → resume listening; mic-permission probe via `getUserMedia` per research §9; two-stage silence policy (30 s gentle prompt, 60 s end-turn) per research §13 with the decoupling-from-STT-lifecycle rule; **90 s max-turn cap** per research §15 (wall-clock; not cancelled by VAD `onSpeechStart`); 10 s `thinking`-watchdog per research §14 / SC-008; `document.visibilitychange` cleanup per research §11; `performance.now()` markers logging the four `[turn-perf]` lines from `quickstart.md`. Plus `src/hooks/useConversationLoop.test.tsx` covering: tap during `listening` → `thinking` ≤ 200 ms (SC-006); mic-stream `track.readyState === 'ended'` for the duration of `speaking` (SC-004); `fetch` hung → bubble exits `thinking` ≤ 10 s (SC-008); silence prompt fires at 30±5 s and end-turn at 60±5 s in 10/10 fake-timer trials (SC-010), and `state.turns.length` is unchanged across the entire silence-end round (no learner turn appended — research §13); 90 s max-turn cap fires when VAD never endpoints, partial STT transcript is forwarded to `ai.ts`, bubble transitions to `thinking` at 90±5 s (FR-009 row of plan's verification matrix); `set-error: 'transport'` after the single retry; loop resumes in `listening` after provider error without appending a tutor reply (FR-020). Acceptance: FR-004, FR-005, FR-006, FR-007, FR-009 (turn-end policy + cap), FR-020, FR-021, FR-027 closed by tests. blockedBy: T005, T006, T007, T008, T009, T010

> **Checkpoint after Phase 2**: The conversation engine works in tests without any UI; `code-reviewer` returned APPROVED.

---

## Phase 3 — View components (parallel-safe after Phase 2)

**Purpose**: Render the three bubble states, the transcript, the settings drawer, and the mic-error surface. Each component is in its own file with no cross-component imports beyond shared types from `src/state/conversation.ts`.

- [x] T012 [P] [US1] Implement `src/components/Bubble.tsx` (centered floating bubble; styled with UnoCSS utility classes including design-token shortcuts; CSS-only `@keyframes` for state-transition animations remain in `src/index.css` because UnoCSS does not replace `@keyframes`; `onPointerDown` dispatches end-of-turn **only** when `bubbleState === 'listening'`; no-op otherwise per FR-008/FR-027; `aria-live` region announces state changes for screen readers). Plus `src/components/Bubble.test.tsx`: three rendered states are visually distinguishable (snapshot per state); tap during `listening` dispatches once and the dispatch happens within 200 ms of `pointerdown` (SC-006); tap during `speaking`/`thinking` dispatches **nothing**. Acceptance: FR-001, FR-002 (visual), FR-008 closed; SC-006 closed (auto leg). blockedBy: T010
- [ ] T013 [P] [US3] Implement `src/components/Transcript.tsx` (chat list rendered from `useTurns()` selector; latest at bottom; scrollable upward; each entry shows speaker label, text, timestamp; tutor-error turns render as a small inline indicator instead of empty text; styled with UnoCSS utility classes — `bg-elevated`, `text-default`, `text-muted`, `border-default`). Plus `src/components/Transcript.test.tsx`: turns render in original order with latest at bottom; speaker label and timestamp are present; tapping the transcript list **does not** dispatch any state action; mid-turn partials never appear (feed an interim STT event into a stub and assert the DOM is unchanged → SC-011 visual leg automated). Acceptance: FR-014, FR-015, FR-016 (rendering) closed; SC-011 (auto leg) closed. blockedBy: T010
- [x] T014 [P] [US4] *(implementation amended 2026-04-29 — no separate SettingsDrawer; controls colocated with Transcript; see note)* Implement `src/components/ThemeToggle.tsx` (research §17, amended): a fixed-position button (top-right) that displays the current theme icon (sun = dark active, moon = light active) and on click calls `setTheme('dark')` when current resolves to light, `setTheme('light')` when current resolves to dark (binary flip; `system` mode is auto-applied on first launch and remains in the store, but the toggle UI exposes only light/dark). Persistence toggle ("Save to this device") and "Clear all" button are inside `Transcript.tsx` header (T013) rather than in a separate drawer, because the Transcript panel already provides the right contextual home for those controls. Wire `togglePersist` and `clearAll` actions per the trigger-path matrix in `contracts/storage-adapter.md`. Plus `src/components/ThemeToggle.test.tsx`: (a) renders moon icon + "Switch to dark" label when current theme resolves to light; (b) renders sun icon + "Switch to light" when resolves to dark; (c) clicking from light sets store theme to dark; (d) clicking from dark sets store theme to light; (e) renders correctly when store has theme: 'system' (resolves via mock matchMedia). Acceptance: ThemeToggle binary flip covered (no exclusive FR per plan module matrix); FR-018 and FR-018a are closed by T013 (Transcript.tsx owns the persistence controls); SC-002/SC-003 (persistence actions in Transcript.tsx) closed. blockedBy: T009, T010 — code-reviewer APPROVED (pending after test fix)
- [x] T015 [P] [US1] Implement `src/components/MicPermissionError.tsx` (rendered when `useError()` selector returns `'mic-denied'`; non-blocking inline error with a "Try again" button that re-runs the `getUserMedia` probe; explicitly **no** text-input fallback per spec Out-of-Scope; styled with UnoCSS utility classes — `bg-elevated`, `text-default`, `border-default`). Plus `src/components/MicPermissionError.test.tsx`: component renders only when the error flag is set; pressing "Try again" calls the orchestrator's retry entry point exactly once. Acceptance: FR-022 closed. blockedBy: T010

> **Checkpoint after Phase 3**: Each component is independently testable; `code-reviewer` APPROVED on each task.

---

## Phase 4 — Composition

**Purpose**: Wire layout, persona system prompt, and the orchestrator at the App level.

- [x] T016 [US1] Implement `src/App.tsx`: no Context provider needed (Zustand stores have no provider); just calls `useConversationLoop()` (from T011) and renders `<TranscriptToggle />` (fixed top-left), `<ThemeToggle />` (fixed top-right), `<Transcript />` (left sidebar panel), `<Bubble />` (centered), and `<MicPermissionError />` overlaid when `useError() === 'mic-denied'`. *(Amended 2026-04-29: no `<SettingsDrawer />`; persistence controls are in Transcript header, per spec.md FR-018 amendment.)* On mount, dispatches `boot` with the result of `storage.loadPrefs()` and `storage.loadTranscript()` so the store hydrates before the orchestrator's first transition; also calls `applyTheme(prefs.theme)` immediately to avoid a flash-of-wrong-theme. Layout uses UnoCSS utility classes (`bg-default`, `text-default`, `min-h-screen`, etc.). Owns the **persona system prompt string** that combines: warm/casual register (FR-025), only-clear-error correction policy (FR-011/FR-013), context window of last 10 finalized turns (research §12), and the silence-prompt template (research §13). Acceptance: FR-023 (no login/onboarding gate before greeting), FR-025 (system prompt content), FR-012 (composition has no separate correction panel/popup); spec acceptance scenarios US1.1 through US1.7 + US2.1 through US2.3 + US3.1, US3.2 + US4.1 through US4.5 are all walkable end-to-end against this composition. blockedBy: T011, T012, T013, T014, T015, T025

> **Checkpoint after Phase 4**: `npm run dev` shows the working MVP. `code-reviewer` APPROVED.

---

## Phase 5 — Verification (parallel-safe; manual + script)

**Purpose**: Close the SCs that need real audio, real proxy traffic, or human judgement.

- [ ] T017 [P] [US1] Add `scripts/check-greeting-variation.mjs`: calls the proxy's `/chat/completions` endpoint 10 times with only the system message (greeting trigger per research §1 / contracts/ai-proxy.md), counts unique greetings, exits 0 iff ≥ 8/10 are unique. Acceptance: SC-009 closed (script run produces "8/10 unique" or higher). blockedBy: T005
- [ ] T018 [P] [US2] Walk the SC-005 manual checklist in `quickstart.md` ("Manual SC checklist" → SC-005 row): hold a 5-minute conversation containing ≥ 20 AI replies with deliberate ESL errors. Acceptance: 0 corrections appear outside the AI's natural reply audio/text; record observations in `.specify/specs/001-voice-conversation-mvp/verification/sc-005.md`. blockedBy: T016
- [ ] T019 [P] [US1] Walk the SC-007 manual checklist in `quickstart.md`: open the app in a fresh profile and complete one full reply round purely by speaking, without any non-bubble UI interaction. Acceptance: pass recorded in `verification/sc-007.md`. blockedBy: T016
- [ ] T020 [P] [US1] Walk the SC-011 visual confirmation in `quickstart.md`: speak during `listening` and confirm no on-screen text of speech ever appears. Acceptance: pass recorded in `verification/sc-011.md`. blockedBy: T016
- [ ] T021 [P] [US1] Run the SC-001 latency measurement in `quickstart.md` (10 turns, capture the `[turn-perf]` console lines). Acceptance: median TOTAL ≤ 3000 ms; if p95 ≥ 3600 ms, escalate per research §10. Record in `verification/sc-001.md`. blockedBy: T016

---

## Phase 6 — PWA polish (sequential where files overlap)

**Purpose**: Finalize the PWA so the iPhone install path works.

- [x] T022 Finalize `vite-plugin-pwa` configuration in `vite.config.ts`: full `manifest` (`name: 'Boom — Daily English Tutor'`, `short_name: 'Boom'`, `display: 'standalone'`, `theme_color: '#7a4cf0'`, `background_color: '#f7f5f2'`); `workbox.runtimeCaching` adds `NetworkOnly` for the AI proxy origin (no vad-web CacheFirst rule — energy VAD has no external model URL per research §5/§6 amendment); `workbox.globPatterns` precaches the app shell. Acceptance: built `dist/manifest.webmanifest` matches research §6 (amended); service worker excludes AI proxy origin from caching. Verified: build confirmed, sw.js inspected. blockedBy: T003, T012 — code-reviewer APPROVED (pending)
- [x] T023 *(implementation amended 2026-04-29 — two SVG sources instead of one `icons.svg`; PNG icons pre-generated and committed; see note)* Add PNG icons `public/icons/192.png` and `public/icons/512.png` generated from `public/icon.svg` using macOS `sips` (committed to repo; regenerate with `sips -s format png --resampleWidth 192 public/icon.svg --out public/icons/192.png && sips -s format png --resampleWidth 512 public/icon.svg --out public/icons/512.png`). Configure `vite-plugin-pwa` `includeAssets` and `manifest.icons` to reference both PNG sizes and both SVG sources (`icon.svg` / `icon-maskable.svg`). Acceptance: `dist/icons/192.png` and `dist/icons/512.png` are produced by `npm run build`; manifest lists 192-px PNG (`any`) and 512-px PNG (`any maskable`) plus SVG entries. Verified: build confirmed, `dist/manifest.webmanifest` lists all four icon entries with correct `sizes` attributes. blockedBy: T022 — code-reviewer APPROVED (pending)
- [ ] T024 Run the iPhone Add-to-Home-Screen smoke test from `quickstart.md` "Manual PWA pass": preview build (`npm run preview -- --host`), open from the dev-machine IP on iPhone Safari, install to Home Screen, launch from the icon, run the smoke test. Acceptance: app launches in `standalone` mode with the manifest name and icons; the smoke test passes. Record in `verification/pwa-iphone.md`. blockedBy: T022, T023

---

## Out-of-scope (deliberately not in this list)

These items are deferred per `spec.md` § "Out of Scope". Reproduced verbatim so a future task author cannot mistake an omission for an opening; do **not** add tasks for any of them in feature 001:

- Pronunciation scoring (numeric or graded). Linguistic corrections only.
- Multi-user, login, or accounts of any kind.
- Conversation export, sharing, or any server upload.
- Analytics, telemetry, or progress tracking.
- Background-audio support; the app stops when the tab is backgrounded.
- Push notifications or reminders.
- Native build (PWA only, per constitution).
- Manual content moderation UI; rely on the AI provider's defaults.
- Voice barge-in (interrupting the AI by speaking).
- Tap-during-`speaking` as a skip/cancel gesture (gesture is reserved; no behavior in this feature).
- Per-turn deletion from the transcript.
- Text-input ("type instead of speak") mode as a fallback when mic permission is denied or unavailable (resolved per Clarifications 2026-04-28).
- Live partial caption of the learner's speech during `listening` (resolved per Clarifications 2026-04-28).
- Tap-outside-`listening` to re-open the mic / extend a turn after VAD endpoints (resolved per Clarifications 2026-04-28). Recovering from a premature VAD cut is deferred to a future feature.

Surfacing any of these requires a spec amendment first (constitution §I).

---

## Dependency graph (compact)

This graph is derived from each task's `blockedBy` clause; arrows reflect *minimum* predecessors, not the layered phase ordering above. T011 and T012–T015 are siblings of T010 — none of the four view components needs T011 as a predecessor (each consumes state types from T010 only; "Try again" in T015 dispatches an action rather than importing the orchestrator). T016 is the convergence point that pulls T011 + T012 + T013 + T014 + T015 together.

```text
T001 ─→ T002 ─→ T003 ─────────────────────────────────────────────┐
   └─→ T004 ──┐   └─→ T025 ──────────────────────────────────┐   │
              ├─→ T005,T006,T007,T008,T009  [Phase 1, all P]  │   │
              │             │                                 │   │
              │             ▼                                 │   │
              │            T010 ──┬─→ T011 ──┐               │   │
              │                   ├─→ T012 ──┤               │   │
              │                   ├─→ T013 ──┼─→ T016 ◀──────┘   │
              │                   ├─→ T014 ──┤    │               │
              │                   └─→ T015 ──┘    │               │
              │                                   ▼               │
              │           T017 ─→ (uses ai.ts only) ◀─ T005       │
              │                                   │               │
              │                                   ▼               │
              │             T018, T019, T020, T021 [Phase 5, all P after T016]
              │                                   │               │
              │                                   ▼               │
              └────────────────────────────────→ T022 ─→ T023 ─→ T024 (PWA polish)
                                                                  ▲
                                                          T012 ◀──┘ (palette in index.css)
```

Authoritative `blockedBy` per task: T002 ← T001 · T003 ← T001 · T004 ← T001 · T005 ← T002,T004 · T006/T007/T008/T009 ← T002 · T010 ← T009,T026 · T011 ← T005,T006,T007,T008,T009,T010 · T012/T013/T015 ← T010 · T014 ← T009,T010 · T016 ← T011,T012,T013,T014,T015,T025 · T017 ← T005 · T018/T019/T020/T021 ← T016 · T022 ← T003,T012 · T023 ← T022 · T024 ← T022,T023 · **T025 ← T001,T003 · T026 ← T001** *(2026-04-28 amendment)*.

## Parallel opportunities

- **Phase 1**: T005, T006, T007, T008, T009 — five primitive libs in parallel after Phase 0. Five disjoint files, five disjoint test files.
- **Phase 3**: T012, T013, T014, T015 — four view components in parallel after T011 (orchestrator) and T010 (state). Four disjoint files.
- **Phase 5**: T017–T021 — verification tasks in parallel after T016 (composition).

## MVP-first slicing

If shipping incrementally, the **smallest demo-able vertical slice** is:

```text
T001..T004 (setup)
+ T005,T006,T007,T008 (primitive libs, US1 only)
+ T010,T011 (state + orchestrator)
+ T012,T015 (Bubble, MicPermissionError)
+ T016 (App composition with system prompt — bring US2 corrections via the prompt)
+ T021 (latency check)
```

That ships **US1 + US2** without persistence (US4) or the visible transcript (US3). Add T009 + T013 + T014 to bring those in. PWA polish (T022–T024) can be deferred until just before user testing.

## Implementation strategy notes

- Two-Reviewer Gate (constitution §II) applies to **every** code-changing task: invoke `code-reviewer` after the edit; loop until APPROVED before checking the box.
- For tasks that include both an implementation file and its test, write the test first or alongside, but do **not** mark the task complete until both files pass review.
- Any deviation from a research-md decision needs a research-md amendment + spec-reviewer pass first; do not silently drift.
- The `verification/` directory under the spec folder is the canonical place for manual SC walkthrough records (T018–T021, T024). Create it on first use.

## Total

**26 tasks** (after 2026-04-28 styling+store amendment): 4 setup + 2 amendment-setup, 5 primitive libs, 2 state/orchestrator, 4 view components (one of which now also produces `ThemeToggle.tsx`), 1 composition, 5 verification, 3 PWA polish.
