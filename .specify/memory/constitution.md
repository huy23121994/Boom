# Boom Constitution

## Core Principles

### I. Spec Before Code (NON-NEGOTIABLE)
No source file under `src/` may be changed without a corresponding entry in
the active feature's `tasks.md`. Every task traces to a requirement in
`spec.md`. Every requirement traces to a user need in this constitution.
The chain is enforced top-down. Code that arrives without paperwork is
reverted, not merged.

### II. Two-Reviewer Gate (NON-NEGOTIABLE)
Every change passes through two automated reviewers before it counts as
done:
- `spec-reviewer` for any edit to `.specify/**/*.md`.
- `code-reviewer` for any edit to `src/**`, `vite.config.ts`, `package.json`,
  or other build/config files.
A reviewer's `REJECTED` verdict blocks the change. The author addresses
every listed issue and re-invokes the reviewer. The loop continues until
the verdict is `APPROVED`. There is no "approve with comments."

### III. Voice-First UX
This is a tool for *talking*. The primary interaction is voice, not
typing. Every feature must be operable hands-free in a normal English
practice session. UI must be quiet — no visual clutter that distracts
from the conversation. Buttons and panels must justify their pixels;
when in doubt, hide.

### IV. Latency Discipline
End-to-end turn latency target: **≤ 3 seconds** from end-of-user-speech to
start-of-AI-audio-response on a typical home connection. Per-component
budgets:
- STT (transcription): ≤ 800 ms
- LLM first token: ≤ 1500 ms
- TTS first audio chunk: ≤ 700 ms
A change that regresses any budget by more than 20% requires an explicit
justification in the spec or it is rejected.

### V. Privacy by Default
Audio recordings, transcripts, and AI responses are **not persisted**
unless the user explicitly opts in for a specific feature (e.g., session
review). Default behavior: in-memory only, cleared on tab close. Any new
storage requires a constitution amendment or, at minimum, an explicit
section in the feature's spec naming what is stored, where, for how long,
and why.

### VI. Free-Tier First
The MVP must run at $0 marginal cost per user beyond the AI inference
proxy already in place. STT and TTS start with browser-native APIs.
Paid services (Whisper-via-proxy, Google Cloud TTS, ElevenLabs, etc.) may
only be introduced when:
1. The free-tier alternative has been measured against an acceptance
   criterion in `spec.md` and demonstrably failed it, AND
2. The plan explicitly justifies the upgrade with the failed measurement.

### VII. MVP Discipline (YAGNI)
Build only what the active feature spec calls for. Defer everything else
into a future feature folder. No speculative abstractions, no plugin
systems, no "we'll need this later" hooks. Three similar lines beat a
premature abstraction. Future flexibility is a feature request, not a
default posture.

## Technology Constraints

- **Frontend:** React 19 + TypeScript + Vite 8.
- **AI inference:** OpenAI-compatible proxy at
  `https://9router-production-5040.up.railway.app/v1`. Default model:
  `gemini/gemini-2.5-flash`. Switching models requires a plan-level note,
  not a constitutional change, but the proxy itself is fixed for the MVP.
- **Distribution:** Progressive Web App, installable on iOS via Safari's
  "Add to Home Screen." No native app build, no App Store submission, no
  Apple Developer account during MVP. Capacitor is allowed only if a
  PWA-only blocker is documented in a feature spec.

## Development Workflow

1. Open or create a feature folder under `.specify/specs/NNN-feature/`.
2. Run `/speckit-specify` (or edit `spec.md`) → invoke `spec-reviewer` →
   loop until `APPROVED`.
3. Run `/speckit-clarify` if any ambiguity remains. Re-invoke
   `spec-reviewer`.
4. Run `/speckit-plan` → invoke `spec-reviewer` again (it reads `plan.md`).
5. Run `/speckit-tasks` → invoke `spec-reviewer` one more time.
6. Run `/speckit-implement` (or implement task by task manually). After
   each task touching code, invoke `code-reviewer`. Loop until
   `APPROVED`. Mark the task completed in `tasks.md` only then.
7. Run `/speckit-analyze` before declaring the feature done — this
   surfaces cross-artifact drift introduced during implementation.

Branching is optional during MVP (solo developer). When a second
contributor joins, this section is amended.

## Governance

This constitution supersedes every other document and every prior
agreement. Amendments require:
1. A short proposal added as a comment-block at the bottom of this file
   (date, author, motivation, proposed text).
2. Explicit user (project owner) acknowledgement.
3. Bumping the version number below.

All PRs and reviewer agents must verify constitutional compliance.
Complexity that violates a principle must be justified by either a
constitution amendment or a one-time exception recorded in the feature's
`plan.md`.

**Version**: 1.0.0 | **Ratified**: 2026-04-28 | **Last Amended**: 2026-04-28
