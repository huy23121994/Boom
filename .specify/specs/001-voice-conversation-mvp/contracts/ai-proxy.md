# Contract: AI Inference Proxy (consumed)

The app consumes an OpenAI-compatible chat completions endpoint. We do not own the proxy; this document captures **only the subset we depend on**, so a reviewer can verify our use is correct and a future ops issue can be diagnosed against this contract.

---

## Endpoint

```
POST {VITE_AI_BASE_URL}/chat/completions
```

`VITE_AI_BASE_URL` is fixed at `https://9router-production-5040.up.railway.app/v1` per constitution and `.env.example`.

## Authentication

```
Authorization: Bearer ${VITE_AI_API_KEY}
```

The API key is supplied at build/dev time via the `.env` file. It is **not** committed (only `.env.example` is). The key is bundled into the client at build time — this is acceptable for an MVP (the proxy enforces its own quotas) but is documented as a known property of the design rather than a security claim.

## Request body (the subset we send)

```json
{
  "model": "gemini/gemini-2.5-flash",
  "stream": true,
  "messages": [
    { "role": "system", "content": "<persona + correction policy + conversation directives>" },
    { "role": "user", "content": "<learner turn 1 text>" },
    { "role": "assistant", "content": "<tutor turn 1 text>" },
    "...up to 10 most-recent turns..."
  ]
}
```

- `model` is read from `VITE_AI_MODEL`, default `gemini/gemini-2.5-flash`.
- `stream: true` is **mandatory** for §IV compliance.
- `messages` always begins with one system message; thereafter alternates user/assistant. Silence-prompt requests use the same shape with an extra system instruction (research §13) appended; the resulting tutor utterance is **not** added back to `messages` for the next turn (it is conversational glue, not content).
- The greeting request is identical except `messages` contains only the system message — the absence of any user message is the signal to produce a varied opener (research §12, FR-003).
- We do **not** send `temperature`, `max_tokens`, `top_p`, or any other parameter for the MVP. Defaults from the proxy/model are accepted.

## Response — streaming (SSE)

The response body is a sequence of `text/event-stream` events. We parse the body as a `ReadableStream<Uint8Array>`, decode UTF-8, split on `\n\n`, and for each event:

```
data: {"id":"...","choices":[{"delta":{"content":"<text fragment>"},"index":0,"finish_reason":null}]}
```

We extract `choices[0].delta.content` and yield it. We ignore `id`, `index`, role-only deltas, and any other fields. The stream ends with the literal:

```
data: [DONE]
```

After which we close the iterator.

### Fields we depend on

| Path | Used for |
|---|---|
| `choices[0].delta.content` | Streamed text fragment; concatenated by the orchestrator and sentence-chunked by `ai.ts`. |
| `choices[0].finish_reason` | If non-null and not `"stop"` (e.g., `"content_filter"`, `"length"`), the orchestrator treats the turn as a provider error (FR-020). |

### Fields we do NOT depend on

`id`, `created`, `model` (echoed), `usage` (often omitted on streaming), `system_fingerprint`. If the proxy's payload changes any of these, our parser does not break.

## Error responses

| HTTP | Behavior |
|---|---|
| 4xx | Treated as provider error. No retry. Orchestrator calls `setError('provider')` on the Zustand store. |
| 5xx / network | Single retry after 250 ms (research §14). On second failure, the orchestrator calls `setError('transport')` on the Zustand store. |
| Stream-level error event (`event: error`) | Treated as provider error. |

## Privacy obligations

Per FR-024 / §V, conversation `messages` are sent to the proxy in flight and **not** logged or persisted client-side beyond the local transcript (when toggle ON). The service worker explicitly excludes this origin from caching.

## Versioning

We pin `model: gemini/gemini-2.5-flash` at the env-variable level. If the proxy retires this model, the env var changes; no code change required. Switching to a non-OpenAI-compatible model would require a plan revision.
