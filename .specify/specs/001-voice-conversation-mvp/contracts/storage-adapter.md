# Contract: Storage Adapter (`src/lib/storage.ts`)

Internal contract for the only module allowed to call `localStorage.*` in this feature. Owns FR-017, FR-018b, FR-018c, FR-018d.

---

## Surface

```ts
// types come from src/state/conversation.ts
export function loadPrefs(): PersistencePreference;
export function savePrefs(p: PersistencePreference): void;

export function loadTranscript(): ConversationTurn[];
export function saveTranscript(turns: ConversationTurn[], prefs: PersistencePreference): void;

export function clearTranscript(): void;   // removes only boom:transcript
export function clearPrefs(): void;        // removes only boom:prefs
export function clearAll(): void;          // removes both keys (composition of the two)
```

## Behavior

### `loadPrefs()`

- Reads `localStorage.getItem('boom:prefs')`.
- If absent or unparseable, returns `{ persistEnabled: false, theme: 'system', version: 1 }` (the default — FR-018a / research §17).
- If `version` is anything other than `1`, returns the same default (treat as corrupt, do not migrate). MUST NOT throw.
- If `theme` is missing or not in `'light' | 'dark' | 'system'`, fall back to `'system'` for that field while keeping the parseable rest. MUST NOT throw.

### `savePrefs(p)`

- Writes `localStorage.setItem('boom:prefs', JSON.stringify(p))`.
- Always runs (the toggle itself must survive reload regardless of its value).
- MUST NOT throw on quota errors; logs once to `console.warn` and returns.

### `loadTranscript()`

- Reads `localStorage.getItem('boom:transcript')`.
- If absent, unparseable, or `version !== 1`, returns `[]`. MUST NOT throw.
- Does **not** consult `prefs.persistEnabled` — read-side is unconditional, because if the user has just toggled OFF we still want a clean read of `[]` (since `clearAll()` runs on toggle-off).

### `saveTranscript(turns, prefs)`

- **If `prefs.persistEnabled !== true`: returns immediately and writes nothing** (FR-017, SC-002).
- Otherwise writes `localStorage.setItem('boom:transcript', JSON.stringify({ turns, version: 1 }))`.
- MUST NOT throw on quota errors; logs once to `console.warn` and returns.

### `clearTranscript()`

- Calls `localStorage.removeItem('boom:transcript')`.
- Always runs unconditionally regardless of `prefs.persistEnabled`.
- Used by the orchestrator on the persistence toggle flip `true → false` (FR-018c). Prefs are not touched, so the toggle UI keeps its just-flipped OFF state without a re-save.

### `clearPrefs()`

- Calls `localStorage.removeItem('boom:prefs')`.
- Always runs unconditionally.
- Used only when the application explicitly wants prefs to revert to defaults on next read.

### `clearAll()`

- Composition: calls `clearTranscript()` then `clearPrefs()`.
- Used by the "Clear all" button in the Transcript panel header (FR-018d). The button handler also invokes `useConversationStore.getState().clearAll()` to empty the in-memory store alongside this call.

### Trigger-path matrix

| UI action | Storage call(s) | In-memory store action |
|---|---|---|
| Persistence toggle `true → false` (FR-018c) | `clearTranscript()` then `savePrefs({persistEnabled:false, theme:<current>, version:1})` | `togglePersist(false)` (the call site invokes `clearTranscript` first; the persisted prefs are then re-written with the new value, preserving the current theme) |
| Persistence toggle `false → true` | `savePrefs({persistEnabled:true, theme:<current>, version:1})` then `saveTranscript(currentTurns, prefs)` | `togglePersist(true)` |
| "Clear all history" button (FR-018d) | `clearAll()` (transcript + prefs) then `savePrefs({persistEnabled:false, theme:'system', version:1})` | `clearAll` |
| Theme cycle (light → dark → system → light) | `savePrefs({persistEnabled:<current>, theme:<next>, version:1})` (via store subscriber) | `setTheme(next)` (subscriber also calls `applyTheme(next)` from `@/lib/theme`) |

> **Note**: The "Clear all history" path remains a documented two-step (clearAll → re-save default prefs) because the user's intent there is "wipe everything" *including* the toggle reverting to default OFF. The toggle-flip path no longer needs the two-step thanks to the split surface.

## Invariants enforceable by code review

1. No file other than `src/lib/storage.ts` calls `window.localStorage.*` or `localStorage.*` directly. (Reviewer checks by grep.)
2. `saveTranscript` is the **only** function that writes the transcript; the Zustand store (and its subscribers) never bypass `saveTranscript` to write `boom:transcript` directly.
3. The persistence guard in `saveTranscript` is the FR-017 enforcement point. A change here must be flagged.

## Test cases (mapped to SCs)

| Test | Asserts | SC |
|---|---|---|
| `saveTranscript([...turns], { persistEnabled: false, version: 1 })` makes 0 `setItem` calls. | FR-017 / SC-002 | SC-002 |
| `saveTranscript([...turns], { persistEnabled: true, version: 1 })` writes the exact JSON shape and round-trips through `loadTranscript()`. | FR-018b | SC-003 |
| `clearTranscript()` after a `saveTranscript(persist=true)` results in `localStorage.getItem('boom:transcript') === null` while `boom:prefs` is untouched. | FR-018c | SC-002 (post-toggle-off) |
| `clearAll()` after a `saveTranscript(persist=true)` results in both `boom:transcript === null` and `boom:prefs === null`. | FR-018d | SC-002 (post-clear) |
| Quota-exhaustion path (`Storage.setItem` throws) does not crash the app and does not set the persisted state to a half-write. | FR-018b | (unmapped — reliability) |
