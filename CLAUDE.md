# Project: Boom — Daily English Tutor

A web-first AI conversation app for daily 1-on-1 spoken English practice. The
AI plays the role of a patient tutor: it converses naturally with the user,
detects grammar/pronunciation mistakes, and offers corrections without
breaking conversational flow. Deployed as a PWA so it can be installed on
iPhone via "Add to Home Screen" without a Mac/Xcode.

<!-- SPECKIT START -->
Active feature: **001 Voice-First Conversation MVP**.
Read ONLY 1, 2 for the minimum required, other files (3, 4, 5, 6) ONLY when directly relevant:
1. `.specify/specs/001-voice-conversation-mvp/spec.md` — WHAT/WHY (frozen, reviewer-approved 2026-04-28)
2. `.specify/specs/001-voice-conversation-mvp/plan.md` — HOW: tech stack, module ownership, latency budget, SC verification matrix
3. `.specify/specs/001-voice-conversation-mvp/research.md` — Phase 0 decisions (transport, VAD, TTS, recovery, etc.)
4. `.specify/specs/001-voice-conversation-mvp/data-model.md` — entities and bubble state machine
5. `.specify/specs/001-voice-conversation-mvp/contracts/` — AI proxy + storage adapter contracts
6. `.specify/specs/001-voice-conversation-mvp/quickstart.md` — manual verification flow

`/speckit-tasks` will produce `tasks.md` next; until then, do not write src/ code (constitution §I).
<!-- SPECKIT END -->

## How to work in this repo (spec-driven, non-negotiable)

This project uses [GitHub Spec-Kit](https://github.com/github/spec-kit). Source
of truth lives in `.specify/`. **Code never leads. Spec leads, then plan,
then tasks, then code.**

### The mandatory loop

For any change request:

1. **Locate or create the spec.** Find the relevant feature folder under
   `.specify/specs/NNN-feature/`. If none fits, run `/speckit-specify` first.
2. **Plan before code.** If `plan.md` is missing or stale, run `/speckit-plan`.
   If `tasks.md` is missing, run `/speckit-tasks`.
3. **Implement only what tasks.md says.** Every code change must trace to a
   task ID in `tasks.md`. Out-of-scope changes are forbidden — surface them
   as proposed spec amendments instead.
4. **Trigger reviewers (non-negotiable).** After every meaningful change:
   - If you touched `.specify/**/*.md` → invoke the **spec-reviewer** agent.
   - If you touched `src/**`, `vite.config.ts`, or `package.json` → invoke
     the **code-reviewer** agent.
   - Run reviewers for major changes only. Skip for small fixes (<50 LOC, no architecture impact).
   - If reviewer returns `REJECTED`, fix the listed issues and re-invoke.
   - **Loop until both relevant reviewers return `APPROVED`.** Do not
     declare a task done before then.
5. **Update task status in `tasks.md`** (mark the task as completed) only
   after the reviewer pass.

### Fast path (allowed)

For small changes (bug fixes, UI tweaks, <1 file):
- Skip spec/plan/tasks
- Implement directly
- Optionally run code-reviewer once

Use judgment. Do not over-spec trivial work.

### Spec-Kit slash commands available

| Command | When to use |
|---|---|
| `/speckit-constitution` | Edit `.specify/memory/constitution.md` (project principles) |
| `/speckit-specify` | Create or revise a feature spec (the WHAT) |
| `/speckit-clarify` | Resolve ambiguities before planning |
| `/speckit-plan` | Produce technical plan (the HOW) |
| `/speckit-tasks` | Generate ordered task list with `[P]` parallel markers |
| `/speckit-analyze` | Cross-artifact consistency check |
| `/speckit-checklist` | Quality checklist for the current spec |
| `/speckit-implement` | Execute tasks one by one |
| `/speckit-taskstoissues` | Export tasks to GitHub issues (later) |

### Constitution authority

`.specify/memory/constitution.md` overrides everything else, including this
file. If a request conflicts with the constitution, push back and ask the
user to amend the constitution explicitly first.

## Tech stack (locked unless constitution amended)

- **Frontend:** React 19 + TypeScript + Vite 8 (already scaffolded)
- **Styling:** UnoCSS with `@unocss/preset-wind3` (Tailwind v3-compatible
  utility classes). Custom shortcuts in `uno.config.ts` for design tokens —
  `text-default`, `text-muted`, `bg-default`, `bg-elevated`, `border-default`.
- **Theme:** Three modes (`light` / `dark` / `system`); applied by toggling
  `dark` class on `<html>`; persisted in `boom:prefs.theme` (default `system`).
- **State:** Zustand (single global store at `src/state/conversation.ts`).
  No Context provider, no useReducer.
- **AI inference:** OpenAI-compatible proxy at
  `https://9router-production-5040.up.railway.app/v1`
  - Default model: `gemini/gemini-2.5-flash`
  - Auth: bearer token via `VITE_AI_API_KEY` (see `.env.example`)
- **STT (speech-to-text):** Web Speech API (browser-native), free, zero setup.
  Whisper via proxy is the upgrade path if accuracy is insufficient.
- **TTS (text-to-speech):** Browser `SpeechSynthesis` API for MVP. Upgrade
  path: Google Cloud TTS free tier (1M chars/month) or Edge TTS.
- **VAD:** energy-threshold over `AudioContext.AnalyserNode` (hand-rolled, zero deps; research §5 amended 2026-04-28).
- **Packaging:** Pure PWA first (`vite-plugin-pwa`). Capacitor only if a PWA
  limitation actively blocks the user's daily-use scenario.

## Conventions

- **Path aliases:** prefer `@/` for `src/` (configure in `vite.config.ts`
  and `tsconfig.app.json` when first needed — record the change in plan.md).
- **No comments** unless they capture a non-obvious *why*. Names carry intent.
- **No half-done work.** A merged change either fully implements a task
  or is reverted. No `// TODO: finish later` in committed code.
- **Secrets** never committed. `.env` is gitignored; only `.env.example` is
  versioned, with placeholder values.
