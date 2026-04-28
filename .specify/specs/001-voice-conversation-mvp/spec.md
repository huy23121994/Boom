# Feature Specification: Voice-First Conversation MVP

**Feature Branch**: `001-voice-conversation-mvp`
**Created**: 2026-04-28
**Status**: Draft
**Input**: User description: "Build feature 001: the voice-first conversation MVP — the core daily-practice loop. The user opens the app and is immediately in a conversation with the AI tutor, with no login, onboarding, or settings to navigate first. The dominant UI element is a single floating bubble centered on the screen…"

## Overview

The first usable version of Boom: opening the app drops the user into a hands-free spoken English conversation with an AI tutor. A single centered bubble represents the system, cycling through three visual states (`speaking`, `listening`, `thinking`) as turns alternate. The AI tutor weaves grammar and word-choice corrections into the natural flow of its replies, never as a separate panel. A scrollable text transcript backs the bubble for visual reference. By default, nothing is persisted; the user can opt in to local-only persistence via a settings drawer.

This feature is the daily-practice loop the entire product orbits. Every later feature (session review, progress tracking, alternative voices, etc.) presupposes that this loop already feels conversational, low-latency, and private.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hands-free spoken conversation loop (Priority: P1)

A learner opens the app and, without tapping anything, is greeted by the tutor and can immediately start talking. They speak; the system detects they have finished; the tutor replies aloud; the cycle repeats until the learner closes the tab. The bubble at the center of the screen is always in exactly one of three states — `speaking`, `listening`, `thinking` — and the learner can read the current state at a glance. If voice activity detection cuts the learner off too early or waits too long, a single tap on the bubble flips the turn boundary the other way.

**Why this priority**: Without the hands-free loop, the product does not exist. Every other feature is a refinement of this loop. A learner who only ever experiences this story still gets meaningful daily practice.

**Independent Test**: Open the app on a phone or laptop with a mic and speakers. Verify the tutor greets the learner unprompted, that speaking and pausing produces a tutor reply, that the bubble's three visual states are distinguishable and accurate, that tapping during `listening` ends the turn, and that the loop resumes automatically after each tutor reply. No transcript, no settings, no corrections need to be present for this story to deliver value.

**Acceptance Scenarios**:

1. **Given** the app has just loaded and the learner has granted mic permission, **When** the page finishes loading, **Then** the bubble enters `speaking` and the tutor speaks a short, model-generated greeting (varied across sessions, not a hardcoded string).
2. **Given** the tutor's greeting has just finished playing, **When** the audio ends, **Then** the bubble auto-transitions to `listening` with no learner action required.
3. **Given** the bubble is in `listening` and the learner has spoken a sentence, **When** the learner remains silent past the VAD endpoint threshold, **Then** the bubble transitions to `thinking` and capture stops.
4. **Given** the bubble is in `listening` and the learner has spoken a sentence, **When** the learner taps the bubble before VAD endpoints, **Then** the bubble immediately transitions to `thinking` and capture stops.
5. **Given** the bubble is in `thinking`, **When** the AI reply is ready, **Then** the bubble transitions to `speaking` and the audio begins playing.
6. **Given** the bubble is in `speaking`, **When** the learner attempts to speak, **Then** no audio is captured (no barge-in) and no turn is started until the bubble exits `speaking`.
7. **Given** the bubble is in `speaking`, **When** the audio finishes, **Then** the bubble auto-transitions back to `listening` with no learner action required.

*(Tapping the bubble outside `listening` cannot re-open the mic or extend a turn that has already ended — this was resolved during clarification as out of scope for feature 001 and is enforced by FR-027.)*

---

### User Story 2 - Tutor-style corrections inside natural replies (Priority: P2)

When the learner makes a clear grammar mistake or noticeably awkward word choice, the tutor's reply both responds to the content of what was said *and* models the correct phrasing — sometimes silently (by using the right form in its own answer), sometimes with a brief explicit acknowledgement ("by the way, we usually say…"). The correction is always part of the conversational reply. There is no separate "you said X wrong" panel, popup, or list.

**Why this priority**: This is what turns the loop from a chatbot into a *tutor*. P2 because the loop is already valuable for fluency practice without it; P1+P2 together is the first version that delivers on the "daily English tutor" promise.

**Independent Test**: With Story 1 working, deliberately speak sentences with clear, common ESL errors (e.g., "I am go to store yesterday"). Verify that at least some replies model the correct phrasing or briefly acknowledge the correction inside the reply text/audio, and that no correction ever appears in a separate UI surface.

**Acceptance Scenarios**:

1. **Given** the learner has just said an utterance containing a clear grammar error, **When** the tutor replies, **Then** the reply either uses the correct phrasing in context, or briefly names the correction within the same reply, but never both surfaces a dedicated "correction panel."
2. **Given** the learner's utterance contains only minor stumbles or neutral phrasing, **When** the tutor replies, **Then** no correction is forced into the reply.
3. **Given** the learner has spoken multiple errors in a single turn, **When** the tutor replies, **Then** at most a small number of the most worth-mentioning errors are addressed in one reply (not an exhaustive list), preserving conversational flow.

---

### User Story 3 - Visible scrollable transcript (Priority: P3)

Behind or above the bubble, the learner sees a chat-style transcript of the conversation so far. Each turn shows speaker (you / tutor), the words said, and a timestamp. The most recent turn sits at the bottom; the learner can scroll upward to review earlier turns. The transcript is for reference only — interaction still happens through voice and the bubble.

**Why this priority**: The transcript improves comprehension (especially for STT mishearings and corrections worth re-reading) but is not required for the loop to function. A learner could practice usefully with audio alone.

**Independent Test**: Hold a multi-turn conversation. Verify each completed turn appears in the transcript with correct speaker label and timestamp; verify the order is chronological with the latest at the bottom; verify upward scrolling reveals earlier turns; verify the transcript is purely visual and tapping it does not change conversation state.

**Acceptance Scenarios**:

1. **Given** a turn has just completed (learner or tutor), **When** the system has the final text, **Then** a transcript entry appears with speaker label, text, and a timestamp, beneath the previous entry.
2. **Given** the transcript has more entries than fit on screen, **When** the learner scrolls upward, **Then** earlier turns are revealed; the bubble and current state remain accessible.

*(Scroll-position behavior on append — whether the transcript auto-scrolls to the new entry or preserves the learner's current scroll offset — is a UX detail not pinned by this spec; it will be resolved during implementation with a sensible default and revisited only if usability testing flags it.)*

---

### User Story 4 - Settings drawer: opt-in local persistence and clear-all (Priority: P3)

A small low-emphasis settings button in the top-right opens a drawer with two controls: a toggle "Save conversations to this device" (default OFF) and a button "Clear all history." When the toggle is OFF, the conversation lives only in memory and disappears when the tab closes. When ON, the conversation is written to local on-device storage only (never uploaded), so reloading the tab restores the prior conversation. "Clear all history" works in both modes and removes every turn from the current view and from any local storage.

**Why this priority**: Persistence is opt-in by design (constitution §V). The default off-state is shipped by Story 1 implicitly. The drawer adds the *opt-in* affordance and the eraser. Without it, learners cannot continue a conversation across reloads — useful, but not blocking the core practice loop.

**Independent Test**: Open the drawer; toggle persistence ON; complete several turns; reload the page and verify the prior turns reappear. Toggle persistence OFF and complete several turns; reload and verify nothing is restored. With either setting, press "Clear all history" and verify the visible transcript and any stored data are both wiped.

**Acceptance Scenarios**:

1. **Given** the drawer is closed, **When** the learner taps the settings icon, **Then** the drawer opens displaying the two controls and does not interrupt any active turn.
2. **Given** the persistence toggle is OFF (default), **When** the learner completes turns and reloads the tab, **Then** the transcript is empty and a fresh greeting begins; no prior text or audio remains anywhere on the device.
3. **Given** the persistence toggle is ON, **When** the learner completes turns and reloads the tab, **Then** the prior transcript is restored and visible before the next turn begins.
4. **Given** any number of turns exist (in memory or persisted), **When** the learner taps "Clear all history" and confirms, **Then** the visible transcript becomes empty and any device-local stored conversation is removed.
5. **Given** the persistence toggle is ON and turns have been stored, **When** the learner switches the toggle to OFF, **Then** all device-local stored conversation data is removed and future turns live only in memory. *(Reasonable default — confirms intent of the toggle.)*

---

### Edge Cases

- **Mic permission never granted**: The browser denies microphone access at first prompt or before. The bubble cannot enter `listening`. The app must surface a recoverable state rather than silently freezing.
- **Mic permission revoked mid-session**: The learner revokes microphone access while a session is in progress. The next attempt to enter `listening` fails. The app surfaces the same re-grant error described above (FR-022).
- **Network drop during `thinking`**: The transcription request or AI request fails because the network is offline or the proxy is unreachable. The learner should not be left staring at a stuck bubble.
- **AI provider error or content filter trip**: The AI responds with an error, a content-filter refusal, or empty text. The bubble must exit `thinking` deterministically.
- **Very long silence in `listening`**: The learner stays silent indefinitely. VAD never endpoints. The mic must not stay hot forever.
- **Very long learner utterance**: The learner speaks continuously for minutes. The system must still produce a turn boundary and a reply (VAD endpoint or hard cap).
- **Tab backgrounded mid-turn**: The learner switches tabs or locks the phone. Per scope, the app may stop; behavior must be predictable rather than hung.
- **Empty or unintelligible STT result**: The transcription comes back blank or junk. The system should not send empty/junk text to the AI as a normal turn.
- **Tap during `speaking` (out of scope this feature)**: The learner taps the bubble during AI audio. The mic stays muted; tap has no defined behavior in feature 001 (see Out of Scope).
- **Tap during `thinking`**: The learner taps the bubble while the system is transcribing or querying. Behavior is a no-op; the request continues to completion (FR-027).
- **Tap outside `listening` to re-open the mic**: After a turn has ended (VAD endpoint or tap), the learner cannot tap to re-open the mic and extend that turn. The next learner turn begins after the tutor's reply, when the bubble auto-returns to `listening`. (FR-027; see Out of Scope.)
- **Two reloads in rapid succession with persistence ON**: The previous transcript must remain intact and the greeting must not duplicate prior turns.
- **First-time mic prompt latency**: On first load, the browser permission prompt may delay the greeting. The bubble should not appear stuck before permission resolves.

## Clarifications

### Session 2026-04-28

- Q: When the learner denies microphone access at the initial prompt or revokes it mid-session, what does the app present? → A: A clear non-blocking error with instructions to re-grant mic permission. No text-input mode is shipped in this feature; the app remains voice-only. (Resolves Q1; also resolves OQ5 — "type instead of speak" mode is **out of scope** for feature 001.)
- Q: What tone should the AI tutor use? → A: Warm and casual — conversational, encouraging, like a patient friend. (See FR-025.)
- Q: How strict is the tutor's correction frequency? → A: Only clear, worth-mentioning errors; minor stumbles MUST NOT be corrected. (Confirms FR-011 / FR-013; no spec change required.)
- Q: What does the tutor do when the learner is silent in `listening` for an extended period? → A: At ~30 s of silence the tutor gently prompts the learner; at ~60 s the tutor ends the turn (transitions to `thinking` or back to `speaking` for the prompt). (Resolves Q2 silence sub-question; see FR-021.)
- Q: During `listening`, should the bubble show a live partial caption of the learner's speech? → A: No. Only the bubble's state indicator is shown; mid-turn STT partials are not surfaced anywhere in the UI. (See FR-026.)
- Q: What does a tap on the bubble do during `thinking`? → A: No-op. The request in flight continues to completion. (See FR-027.)
- Q: Outside `listening` (after VAD endpointed and capture stopped), can the learner tap the bubble to re-open the mic and extend the same turn? → A: No — out of scope for feature 001. Once a turn ends, it ends; recovering from a premature VAD cut is deferred to a future feature. (See Out of Scope.)

### Resolved as assumptions (not blocking the spec)

These were listed as open questions in the input but have reasonable defaults captured below in the Assumptions section:

- **Network drops mid-turn (OQ2)** → bounded auto-retry then explicit error with a retry affordance; bubble returns to `listening` if the learner declines retry. (See FR-019.)
- **Per-turn deletion (OQ4)** → out of scope; "Clear all history" is the only deletion path for this feature. (See Out of Scope.)
- **AI errors / content-filter trips (OQ6)** → bubble shows a brief error indicator, the failed turn is *not* added to the transcript as a successful turn (the learner's transcribed utterance may be retained or dropped — see FR-020), and the bubble returns to `listening`. (See FR-020.)
- **Tap during `speaking` as a "skip" (OQ8)** → out of scope for this feature. The mic stays muted during `speaking` and tapping during `speaking` is reserved for a future feature with no current behavior. (See Out of Scope.)

## Requirements *(mandatory)*

### Functional Requirements

#### Conversation loop and bubble state machine
- **FR-001**: The application MUST present a single dominant bubble centered on the screen as the primary interaction surface.
- **FR-002**: The bubble MUST at all times reflect exactly one of three states — `speaking`, `listening`, `thinking` — and these states MUST be visually distinguishable at a glance.
- **FR-003**: On first load, after any required browser permission prompt resolves, the bubble MUST enter `speaking` and the tutor MUST deliver an opening greeting whose text is generated by the same AI model used for replies (i.e., not a hardcoded string), with reasonable variation across sessions.
- **FR-004**: When AI audio finishes playing in `speaking`, the bubble MUST auto-transition to `listening` without requiring a learner action.
- **FR-005**: When a learner turn ends (by VAD endpoint or by tap), the bubble MUST transition to `thinking` and audio capture MUST stop.
- **FR-006**: When the AI reply is ready and audio playback begins, the bubble MUST transition to `thinking → speaking`.
- **FR-007**: While the bubble is in `speaking`, the application MUST NOT capture microphone audio. Barge-in is explicitly disallowed for this feature.
- **FR-008**: The bubble MUST react to a tap on it during `listening` as a manual end-of-turn signal, immediately moving to `thinking`.
- **FR-009**: Voice activity detection MUST be the default mechanism for ending a learner turn, with tap as an override; the application MUST tolerate noisy environments without freezing in `listening` indefinitely (a hard cap on turn duration MUST exist; the value is left to the plan, but must be enforced).

#### AI reply behavior and corrections
- **FR-010**: AI replies MUST be generated using the learner's current transcript plus recent conversation history (sufficient context for coherent multi-turn dialogue).
- **FR-011**: When the learner's utterance contains a clear grammar mistake or awkward word choice worth mentioning, the AI reply MUST weave a correction into the natural reply, either by modeling the correct phrasing in context or by briefly naming the correction inside the same reply.
- **FR-012**: The application MUST NOT present corrections in a separate panel, popup, sidebar, badge, list, or any UI surface other than inside the AI's natural reply text and audio.
- **FR-013**: Minor stumbles or non-error variations MUST NOT trigger forced corrections; only clear, worth-mentioning errors should.

#### Transcript display
- **FR-014**: The application MUST display a chat-style transcript visible alongside or behind the bubble, with the most recent turn at the bottom and the ability to scroll upward to earlier turns.
- **FR-015**: Each transcript entry MUST show the speaker (learner or tutor), the text of what was said, and a timestamp.
- **FR-016**: Transcript entries MUST be appended only after a turn finalizes (i.e., after STT for a learner turn and after the AI text is available for a tutor turn). Mid-turn partials MUST NOT be appended to the transcript.

#### Persistence and privacy controls
- **FR-017**: The application MUST default to in-memory-only storage of all transcripts and audio: when the persistence toggle is OFF, no transcript, audio, or conversation metadata is written to any persistent storage on the device, and tab close clears all conversation data.
- **FR-018**: The application MUST provide a settings drawer accessible via a small low-emphasis settings control in the top-right of the screen, opened without interrupting any active turn.

##### Drawer controls
- **FR-018a**: The drawer MUST contain a toggle labeled "Save conversations to this device" with the default value OFF.
- **FR-018b**: When the toggle is ON, the application MUST persist transcripts on the user's device only (no upload to any server) such that a full reload restores the prior transcript.
- **FR-018c**: When the toggle is switched from ON to OFF, the application MUST remove any device-local stored conversation data.
- **FR-018d**: The drawer MUST contain a "Clear all history" action that wipes the visible transcript and any device-local stored conversation data, available regardless of the toggle state.

#### Error and edge handling
- **FR-019**: If transcription or AI request fails because of network or proxy unavailability, the application MUST attempt a bounded auto-retry, and if still failing MUST surface a clear, recoverable error indicator and return the bubble to `listening` (or to a clearly idle state) within a reasonable bound; the bubble MUST NOT remain stuck in `thinking` indefinitely.
- **FR-020**: If the AI provider returns an error, refusal, or empty text, the bubble MUST exit `thinking` deterministically; the failed turn MUST NOT be appended to the transcript as a successful tutor reply; the learner's already-transcribed utterance MAY remain in the transcript (treated as a completed learner turn that simply received no reply), and the loop MUST resume in `listening`.
- **FR-021**: When the learner is silent in `listening`, the application MUST follow a two-stage silence policy: at approximately **30 seconds** of continuous silence the tutor MUST gently prompt the learner (e.g., a brief encouragement to keep the conversation going), and at approximately **60 seconds** of total silence the application MUST end the turn deterministically rather than leave the mic hot. Exact thresholds may be tuned in the plan within ±10 seconds of these targets.
- **FR-022**: When microphone permission is denied at the initial prompt or revoked mid-session, the application MUST present a clear, non-blocking error message with instructions for the learner to re-grant permission, and MUST NOT freeze in any bubble state. The application MUST NOT fall back to a text-input mode; if the learner re-grants permission, the conversation loop MUST resume from `listening`.

#### General
- **FR-023**: No login, account creation, or onboarding step MAY block the learner between opening the app and hearing the tutor's greeting.
- **FR-024**: All conversation data, including audio, transcripts, and AI responses, MUST stay on the device or in flight to the AI inference proxy; the application MUST NOT upload conversation data to any other server.

#### Tutor persona and bubble UI surface
- **FR-025**: The tutor's reply style MUST be warm and casual — conversational and encouraging rather than formal or instructional in register — to lower the learner's speaking anxiety. This applies to both reply text content and TTS delivery where the synthesizer permits.
- **FR-026**: During `listening`, the bubble area MUST NOT display a live partial caption of the learner's speech. Only the bubble's state indicator is shown; mid-turn STT partials MUST NOT be surfaced anywhere in the UI for this feature.
- **FR-027**: A tap on the bubble while it is in `thinking` MUST be a no-op; the in-flight transcription or AI request MUST continue to completion. A tap on the bubble outside `listening` MUST NOT re-open the microphone or extend a turn that has already ended.

### Key Entities

- **ConversationTurn**: One side of one exchange. Attributes: speaker (`learner` or `tutor`), text content, timestamp at finalization. A turn is created only when finalized (FR-016). Lives in memory by default; serialized to device-local storage only when the persistence toggle is ON.
- **Conversation**: An ordered sequence of `ConversationTurn`s, scoped to a single tab/session unless persisted. Has at most one currently-active turn at any time.
- **BubbleState**: An enum-like value with exactly three members — `speaking`, `listening`, `thinking` — driven by the conversation state machine; the visible bubble's appearance is a pure function of this value (plus minor sub-states like "loading first reply" treated visually as `thinking`).
- **PersistencePreference**: A single boolean for "save conversations to this device." Persisted itself across reloads (otherwise the toggle is meaningless), but its persistence is a tiny bookkeeping value, not conversation content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the moment a learner turn ends (VAD endpoint or tap) to the moment AI audio begins playing, the median elapsed time on a typical home connection is **≤ 3000 ms** (constitution §IV).
- **SC-002**: With the "Save conversations to this device" toggle OFF, an automated check after a session finds **zero bytes** of transcript, audio, or conversation metadata written to any persistent device storage, and a reload begins from a fresh greeting.
- **SC-003**: With the toggle ON, after a full reload of the tab, **100%** of finalized turns from before the reload appear in the restored transcript, in their original order and with original timestamps.
- **SC-004**: While the bubble is in `speaking`, an automated check confirms the microphone capture stream is **not active** (no audio frames captured) for the entire duration of the AI utterance.
- **SC-005**: In a manual review of at least 20 sample replies, **0** corrections appear outside the natural reply (no separate panel, popup, or list); **all** corrections that do appear are inside the reply text/audio.
- **SC-006**: Tapping the bubble during `listening` ends the current turn and moves to `thinking` in **≤ 200 ms** of perceived latency.
- **SC-007**: A learner can complete the full loop — open → hear greeting → speak → hear reply — without tapping, typing, or navigating any non-bubble UI element, on **first launch** of the app.
- **SC-008**: When network is dropped mid-`thinking`, the bubble exits `thinking` (to a recoverable error or back to `listening`) within **≤ 10 seconds**; the bubble never stays in `thinking` for longer than that bound.
- **SC-009**: The greeting text differs across **at least 80%** of fresh sessions in a sample of 10 cold opens, demonstrating model-generated variation rather than a hardcoded string.
- **SC-010**: When the learner remains silent in `listening`, the tutor emits a gentle prompt within **30 ± 5 s** of continuous silence, and the bubble exits `listening` within **60 ± 5 s** of total silence, in 10 of 10 measured silent-listening trials.
- **SC-011**: Across at least 10 listening turns of varying length, **0** characters of STT partial text appear in the UI during `listening`; only the bubble's state indicator is visible.

## Assumptions

These are reasonable defaults adopted to keep the spec testable without enlarging scope; revisit during `/speckit-clarify` if any prove wrong.

- **Default user context**: A solo English learner using the app on a phone (iOS Safari PWA) or laptop with a working microphone and speakers, on a typical home internet connection.
- **No accounts**: Single-device, single-user, no auth, no profile. Multi-device sync, accounts, and login are deferred to a future feature.
- **Browser-native STT and TTS only** (constitution §VI): The MVP relies on the browser's built-in capabilities for transcription and speech synthesis. Switching to a paid service requires measured failure of the free-tier alternative against a criterion in this spec.
- **Network drop default behavior** (resolves OQ2): Bounded auto-retry once, then explicit error indicator and return to `listening`. Failed turns do not pollute the transcript as successful exchanges.
- **Per-turn deletion** (resolves OQ4): Not in scope. "Clear all history" is the only deletion path in this feature.
- **AI errors and content-filter trips** (resolves OQ6): Bubble exits `thinking` deterministically; the tutor reply is never appended on failure; the loop resumes in `listening`. The failed learner turn is preserved in the transcript as a completed learner utterance with no tutor reply attached.
- **Tap during `speaking` as a skip/cancel** (resolves OQ8): Not in scope for this feature. The mic stays muted during `speaking`. Future feature may repurpose this gesture as "skip current AI utterance"; no behavior is implemented now.
- **Greeting variation**: The model is asked to produce a short conversational opener; we assume the proxy can return a varied opener consistently. If variation drops below SC-009, the plan will revisit.
- **Recent conversation history window**: "Recent" is left to the plan; for this spec it suffices that AI replies have enough context to feel coherent across at least the most recent ~10 turns.
- **Hard caps**: silence cap is pinned at ~30 s gentle-prompt and ~60 s end-of-turn (FR-021). Max turn duration and max retry duration remain enforced but their numeric values are deferred to the plan.

## Out of Scope

Each item below is deliberately deferred to a future feature and MUST NOT be implemented as part of feature 001:

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

## Dependencies

- **AI inference proxy** at `https://9router-production-5040.up.railway.app/v1` with the default model `gemini/gemini-2.5-flash` is reachable from the learner's browser and is used for greeting generation, conversational replies, and weaved corrections.
- **Browser APIs** for microphone capture, voice activity detection, speech-to-text, and speech synthesis are available on the learner's target browser (modern iOS Safari for PWA, modern desktop Chrome/Safari/Firefox).
- **Constitution §IV, §V, §VI** are in force and have been factored into the requirements above.
