#!/usr/bin/env node
/**
 * SC-009 verification: greeting variation.
 * Calls the AI proxy 10 times with only the system message (cold-open trigger)
 * and asserts that ≥ 8 out of 10 responses are unique greetings.
 *
 * Usage:
 *   node scripts/check-greeting-variation.mjs
 *
 * Reads VITE_AI_BASE_URL / VITE_AI_API_KEY / VITE_AI_MODEL from .env.local or .env.
 * Exits 0 on pass, 1 on failure.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Minimal .env loader (no dotenv dep needed)
// ---------------------------------------------------------------------------
function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    try {
      const text = readFileSync(resolve(process.cwd(), name), 'utf8')
      for (const line of text.split('\n')) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/)
        if (m) {
          // strip inline comments before trimming, then strip surrounding quotes
          const val = m[2].replace(/\s*#.*$/, '').trim().replace(/^['"]|['"]$/g, '')
          process.env[m[1]] ??= val
        }
      }
      break
    } catch {
      // file not found — try next
    }
  }
}

loadEnv()

const BASE_URL = process.env.VITE_AI_BASE_URL
const API_KEY = process.env.VITE_AI_API_KEY
const MODEL = process.env.VITE_AI_MODEL ?? 'gemini/gemini-2.5-flash'

if (!BASE_URL || !API_KEY) {
  console.error(
    'Missing VITE_AI_BASE_URL or VITE_AI_API_KEY — copy .env.example to .env.local and fill in values.',
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// System prompt (must match src/lib/persona.ts SYSTEM_PROMPT)
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are Boom, a warm and casual English-conversation tutor. You are talking 1-on-1 with a single English learner who wants daily speaking practice.

Style: warm, casual, encouraging. Speak like a patient friend, never formal or instructional. Keep replies SHORT — one to two sentences total, around 20–35 words. Never lecture. Ask one follow-up question per reply to keep things moving.

Corrections: when the learner makes a clear grammar mistake or noticeably awkward word choice that is worth mentioning, weave a correction into your natural reply. Either model the correct phrasing in your own answer (silent correction) or briefly acknowledge the correction inside the same reply (e.g., "by the way, we usually say…"). Do not list errors. Do not produce a separate "you said X wrong" panel — corrections are always part of the natural reply text. Do not force a correction on minor stumbles or harmless variation; only on clear, worth-mentioning errors.

If the learner appears to start a new topic, follow the new topic. If they are silent or hesitating, gently invite them to keep going.

If you are sent only this system prompt with no prior turns, that means a fresh session is starting — produce a brief, varied conversational opener: ONE short greeting followed by ONE light open question. Hard cap: ≤ 18 words total. Vary the opener across sessions; do not repeat the same template. Never introduce yourself, never list what you can do, never say "I am here to help" — just dive in like a friend.`

// ---------------------------------------------------------------------------
// Fetch one greeting via streaming SSE — matches the app's ai.ts request shape
// contracts/ai-proxy.md: stream:true is mandatory; no extra sampling params.
// ---------------------------------------------------------------------------
async function fetchGreeting() {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
  }

  // Parse SSE stream: collect delta.content fragments until [DONE]
  const text = await res.text()
  let content = ''
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const data = line.slice(6).trim()
    if (data === '[DONE]') break
    try {
      const json = JSON.parse(data)
      const delta = json.choices?.[0]?.delta?.content
      if (delta) content += delta
    } catch {
      // ignore malformed SSE chunk
    }
  }
  return content.trim()
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const TOTAL = 10
const PASS_THRESHOLD = 8

console.log(`SC-009 — greeting variation check (${TOTAL} calls, threshold ≥${PASS_THRESHOLD} unique)\n`)

const greetings = []
for (let i = 1; i <= TOTAL; i++) {
  process.stdout.write(`  [${i}/${TOTAL}] `)
  try {
    const g = await fetchGreeting()
    greetings.push(g)
    console.log(JSON.stringify(g))
  } catch (err) {
    console.error(`ERROR: ${err.message}`)
    process.exit(1)
  }
}

const unique = new Set(greetings.map((g) => g.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()))
const uniqueCount = unique.size

console.log(`\nUnique greetings: ${uniqueCount}/${TOTAL}`)

if (uniqueCount >= PASS_THRESHOLD) {
  console.log(`PASS — SC-009 satisfied (${uniqueCount} ≥ ${PASS_THRESHOLD} unique)`)
  process.exit(0)
} else {
  console.error(`FAIL — SC-009 not satisfied (${uniqueCount} < ${PASS_THRESHOLD} unique)`)
  process.exit(1)
}
