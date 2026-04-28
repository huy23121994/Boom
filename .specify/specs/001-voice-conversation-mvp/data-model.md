# Phase 1 — Data Model: Voice-First Conversation MVP

All entities live in the browser process. None are sent to any server except the LLM-bound `messages` array (a derivation of `Conversation.turns`), which is in-flight only and never logged.

---

## Entity: `ConversationTurn`

One side of one exchange. Created exactly once at finalization (FR-016).

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | yes | UUID v4 generated at finalization. Stable across reloads if persisted. |
| `speaker` | `'learner' \| 'tutor'` | yes | No third value; system silence-prompts ride on the same `speaker: 'tutor'` shape. |
| `text` | `string` | yes | Final transcript text (learner) or final reply text (tutor). Mid-turn partials never produce a `ConversationTurn`. Trimmed; empty strings forbidden. |
| `timestamp` | `number` | yes | `Date.now()` at finalization. |
| `error` | `'transport' \| 'provider' \| 'silence' \| undefined` | no | Set only on tutor-side turns when the AI failed (FR-020). When set, the turn is treated as a "no-reply" placeholder by the renderer. |

### Validation rules

- `text` must be non-empty after `trim()` for any turn that is **not** an error placeholder.
- `timestamp` must be ≤ `Date.now()` at the moment of insertion.
- A `learner` turn MUST NOT have `error` set. Errors only attach to `tutor` turns.
- A `tutor` turn marked as `error` MAY have an empty `text` (the renderer falls back to a small inline indicator).

---

## Entity: `Conversation`

Append-only ordered list of `ConversationTurn`s. Lives in memory; serialized to `localStorage` only when `prefs.persistEnabled === true` (FR-017).

| Field | Type | Required | Notes |
|---|---|---|---|
| `turns` | `ConversationTurn[]` | yes | Ordered earliest-first. The renderer reverses for "latest at bottom." |
| `bubbleState` | `BubbleState` | yes | One of three values; see state machine below. |
| `activeError` | `'mic-denied' \| 'transport' \| 'provider' \| undefined` | no | Transient UI state; not persisted. |

### Invariants

- `turns` length is unbounded in memory; only the **last 10** are forwarded to the LLM (research §12).
- At most **one** "active" turn exists at any time — i.e., `bubbleState !== 'listening'` ⇒ no learner turn is in progress; `bubbleState !== 'speaking'` ⇒ no tutor turn is in progress.
- Append-only: turns can be removed only by `clearAll()` from the storage adapter or by hot-reload during dev.

---

## Entity: `BubbleState` (enum)

Exactly three values; FR-002 forbids a fourth.

```ts
type BubbleState = 'speaking' | 'listening' | 'thinking';
```

### State transitions

This is the canonical machine; all other transitions are bugs.

| From | Event | To | FR |
|---|---|---|---|
| *(initial)* | App boots, mic permission granted, greeting started | `speaking` | FR-003 |
| `speaking` | TTS utterance completes | `listening` | FR-004 |
| `listening` | VAD `onSpeechEnd` fires | `thinking` | FR-005, FR-009 |
| `listening` | Bubble tap (FR-008) | `thinking` | FR-005, FR-008 |
| `listening` | 60 s silence cap hit (FR-021) | `thinking` (no learner turn appended) → silence-prompt utterance plays in `speaking` → `listening` | FR-021, SC-010 |
| `listening` | 90 s max-turn cap hit (research §15) | `thinking` (with whatever STT transcript was captured up to the cap) | FR-009 |
| `thinking` | First TTS sentence ready | `speaking` | FR-006 |
| `thinking` | Network error → bounded retry → still failing | `listening` (with `activeError`) | FR-019, FR-020, SC-008 |
| `thinking` | AI provider error / refusal | `listening` (turn appended without tutor reply) | FR-020 |
| `speaking` | TTS cancelled by orchestrator (visibility, error) | `listening` (idle) | research §11 |
| any | Mic permission lost (`NotAllowedError`) | `listening` (idle) with `activeError = 'mic-denied'` | FR-022 |

### Forbidden transitions

- `listening` → `speaking` directly (must pass through `thinking`). Enforced by orchestrator.
- `speaking` → `thinking` (the AI never re-thinks mid-utterance; it can only be cancelled).
- Any tap-driven transition originating from `speaking` or `thinking` (FR-007, FR-027).

---

## Entity: `PersistencePreference`

User preferences blob. Always persisted regardless of `persistEnabled` (the toggle and the theme must survive reload — research §8 / §17).

| Field | Type | Required | Notes |
|---|---|---|---|
| `persistEnabled` | `boolean` | yes | Default `false` (FR-018a). |
| `theme` | `'light' \| 'dark' \| 'system'` | yes | Default `'system'` (research §17). The Zustand store calls `applyTheme()` whenever this field changes. |
| `version` | `number` | yes | Schema version of the persisted blob; bump if the storage shape changes. Initial value: `1`. |

The `prefs` blob is **always** persisted (the toggle itself and the theme must survive reload — research §8 and §17). Its persistence is a tiny bookkeeping value, not conversation content.

### Validation rules

- `persistEnabled` and `theme` are the meaningful fields. `version` is reserved for migration logic.
- On read, if `version` is absent or not a number, treat the blob as corrupt and reset to defaults. Do not attempt to migrate.
- On read, if `theme` is missing or not one of `'light' | 'dark' | 'system'`, default to `'system'` (do not throw; do not persist a corrupted blob).
- A flip from `persistEnabled: true → false` MUST trigger `storage.clearTranscript()` immediately (FR-018c). Prefs are then re-saved with the new `persistEnabled: false` value via `storage.savePrefs(...)`. The split storage surface (see `contracts/storage-adapter.md`) ensures the toggle UI keeps its OFF state without an intermediate erase-and-restore.
- A change to `theme` MUST trigger `applyTheme(theme)` (research §17) and `storage.savePrefs(...)`. No effect on `boom:transcript`.

---

## Storage layout (`localStorage`)

Two keys under the `boom:` namespace:

| Key | Written when | Shape |
|---|---|---|
| `boom:prefs` | always (whenever the toggle or theme is touched) | `{ persistEnabled: boolean, theme: 'light' \| 'dark' \| 'system', version: 1 }` |
| `boom:transcript` | only when `prefs.persistEnabled === true` | `{ turns: ConversationTurn[], version: 1 }` |

Both blobs are JSON. No other keys are written by this feature. Clearing happens via `storage.clearAll()` removing both keys; the in-memory state is reset by a separate `clearAll()` action call on the Zustand store (`useConversationStore.getState().clearAll()`) that the SettingsDrawer fires alongside the storage call.

## Store action surface (Zustand)

The Zustand store in `src/state/conversation.ts` exposes a closed set of setters. Listing them as part of the data model so the contract review is comprehensive. Each setter is invoked either as `useConversationStore.getState().<action>(...)` (from outside React) or via a selector hook (from inside React).

| Action | Payload | Effect |
|---|---|---|
| `boot` | `{ persistedTurns?: ConversationTurn[], prefs: PersistencePreference }` | Hydrate from storage on first render; also calls `applyTheme(prefs.theme)` so initial paint uses the persisted theme. |
| `setBubble` | `BubbleState` | Pure state transition; orchestrator-only. |
| `appendTurn` | `ConversationTurn` | Push to `turns`; persist iff toggle ON (via subscriber → `storage.saveTranscript`). |
| `setError` | `Conversation['activeError']` | Set or clear the transient error. |
| `clearAll` | `void` | Empty `turns`; reset prefs to default `{ persistEnabled: false, theme: 'system', version: 1 }`. Storage adapter call (`storage.clearAll()` + `savePrefs(default)`) is performed by the call site (the SettingsDrawer button handler) alongside this store action. |
| `togglePersist` | `boolean` | Update `prefs.persistEnabled`. When going `true → false`, the call site calls `storage.clearTranscript()` and then `storage.savePrefs(newPrefs)`. When going `false → true`, the call site calls `storage.savePrefs(newPrefs)` then `storage.saveTranscript(turns, newPrefs)`. |
| `setTheme` | `'light' \| 'dark' \| 'system'` | Update `prefs.theme`. The store's subscriber calls `applyTheme(theme)` from `@/lib/theme` and then `storage.savePrefs(newPrefs)`. No effect on `boom:transcript`. |
