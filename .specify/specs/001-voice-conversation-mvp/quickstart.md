# Quickstart — Voice-First Conversation MVP

Walks a developer from a fresh clone to a verified MVP. SCs that need a human ear or eye live at the bottom.

---

## Prerequisites

- Node 22+ (Vite 8 baseline).
- A microphone and speakers / headphones on the dev machine.
- A modern browser: latest Chrome, Safari, or Firefox.
- An iPhone with iOS 17+ and Safari, on the same Wi-Fi as the dev machine, for the PWA mobile pass.

## One-time setup

```sh
cp .env.example .env
# fill in VITE_AI_API_KEY in .env (never commit)
npm install
```

Required `.env` keys:

```env
VITE_AI_BASE_URL=https://9router-production-5040.up.railway.app/v1
VITE_AI_API_KEY=<provided separately, never committed>
VITE_AI_MODEL=gemini/gemini-2.5-flash
```

## Dev loop

```sh
npm run dev      # Vite dev server on http://localhost:5173
npm run build    # production build (PWA artifacts emitted into dist/)
npm run preview  # serve the prod build (use this for PWA install testing)
npm run lint     # ESLint
npm test         # Vitest (after Vitest is added in tasks)
```

## Smoke test (1 minute, covers SC-001 / SC-007 by feel)

1. `npm run dev`, open `http://localhost:5173`, grant the mic prompt.
2. Hear a greeting within ~2 s of permission grant. (FR-003)
3. Say one short sentence (e.g., "I went to the park yesterday with my friend"). Stop talking.
4. Bubble transitions: `listening → thinking → speaking → listening`. The first audio of the AI reply should begin within ~3 s of you finishing speaking. (SC-001)
5. Speak a clear ESL error: "I am go to store yesterday." Verify the AI's reply weaves a correction (e.g., uses "I went to the store yesterday" in its own sentence) without opening any separate panel. (SC-005)
6. Tap the bubble while it is `listening` and speaking — it should immediately move to `thinking`. (SC-006, FR-008)
7. Tap the top-left toggle to open the Transcript panel. In the panel header, toggle "Save to this device" ON. Reload the tab. Prior turns should reappear. (SC-003)
8. Open the Transcript panel again; toggle back OFF. Reload. Transcript should be empty. (SC-002)
9. Open the Transcript panel; press "Clear all" with the toggle in either state. Transcript empties; reload again confirms nothing comes back. (FR-018d)

If any of those fails, do not advance to `/speckit-tasks` follow-on work without a plan revision.

## Manual SC checklist

These are the SCs that cannot be unit-tested. The sample size in each row is the minimum.

| SC | Steps | Pass criterion |
|---|---|---|
| **SC-005** (no out-of-reply corrections) | Hold a 5-minute conversation containing at least 20 AI replies. Speak deliberate ESL errors in roughly half. | 0 corrections appear outside the AI's natural reply audio/text — no toast, no panel, no list. |
| **SC-007** (first-launch hands-free) | Open the app in a fresh profile. Do not touch anything other than the OS mic-permission prompt. | You hear the greeting and complete one full reply round purely by speaking. No taps, no menu opens. |
| **SC-009** (greeting variation) | Run the helper script `node scripts/check-greeting-variation.mjs` (added in tasks; uses the same proxy + model). It calls the greeting endpoint 10× and reports the unique-count. | At least **8 out of 10** greetings are unique. |
| **SC-011** (no live caption) | Watch the bubble during `listening` while speaking. | No on-screen text of your speech ever appears. The bubble shows only its state. |

## Manual PWA pass (iPhone)

1. Build and preview: `npm run build && npm run preview -- --host`.
2. On iPhone Safari, open `http://<dev-machine-ip>:4173` (Vite preview default).
3. Tap the share icon → "Add to Home Screen". Confirm the manifest name "Boom — Daily English Tutor" and the bubble icon are correct.
4. Open from the home-screen icon. App should launch in standalone mode (no Safari chrome).
5. Run the smoke test above on iPhone. Note any STT drops; the auto-restart logic in `src/lib/stt.ts` should make them invisible up to 3 in a row.

## Latency measurement (SC-001 raw)

In dev mode, the orchestrator logs `performance.now()` markers to the console:

```
[turn-perf] vad-end → stt-final: 612 ms
[turn-perf] stt-final → ai-first-token: 1320 ms
[turn-perf] ai-first-sentence → tts-first-audio: 540 ms
[turn-perf] vad-end → tts-first-audio (TOTAL): 2472 ms
```

Run 10 turns of typical short utterances. Median TOTAL should be ≤ 3000 ms. If p95 ≥ 3600 ms, escalate per `research.md` §10.

## What to do if a step fails

- **Mic prompt never appears**: Check the browser site permissions; deny → re-grant via the lock icon. The "Try again" button in the in-app error UI re-runs the `getUserMedia` probe.
- **Greeting never plays**: Check `VITE_AI_API_KEY` is set and the proxy is reachable; check `console` for `[ai] transport error`.
- **Bubble stuck in `thinking`**: Wait up to 10 s — the watchdog should bail (SC-008). If it doesn't, that's a bug.
- **`vad-web` model fails to load**: Check the network tab for the onnx fetch; first load needs network. Subsequent loads come from the service worker cache.
