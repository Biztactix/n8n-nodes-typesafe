# n8n-nodes-typesafe — Architecture

## Shape

A single npm package loaded in-process by n8n. No server, no database, no state of its own. n8n discovers the entry points through the `n8n` block in `package.json` (`dist/credentials/TypeSafeApi.credentials.js`, `dist/nodes/TypeSafe/TypeSafe.node.js`).

```
Trigger (Outlook / IMAP / any) ─▶ TypeSafe AI node ─▶ Switch / IF on results.<name>
                                        │
                                        ▼  HTTPS, Authorization: Bearer
                                 api.typesafe.ai  (/v1/systemone, /v1/models)
```

## Service map

| Unit | Path | Responsibility | Talks to |
|------|------|----------------|----------|
| Credential `typeSafeApi` | `credentials/TypeSafeApi.credentials.ts` | `apiKey` (password) + `baseUrl`; generic Bearer auth; credential test via `GET /v1/models` | n8n credential store, TypeSafe API |
| Node `typeSafe` | `nodes/TypeSafe/TypeSafe.node.ts` | UI description, `getModels` load-options, `execute` loop per input item, error mapping | `questions.ts`, n8n HTTP helper |
| Question builder | `nodes/TypeSafe/questions.ts` | Pure functions: `buildQuestions` (UI collection + raw JSON overlay → API `questions`), `flattenAnswers` (answers → `results`). Unit-test target | nothing |
| Smoke script | `scripts/smoke.mjs` | Direct `fetch` with the node's wire shapes; checks the contract without n8n | TypeSafe API |
| Starter workflow | `examples/email-classifier.workflow.json` | Importable: email trigger → TypeSafe AI → Switch on category | — |
| Reference SDK (sibling repo) | `../TypesafeAI-C#` | Source of truth for the wire format (`Constants.cs`, `Questions.cs`) | — |

## Contracts

### TypeSafe API (external)

- Base URL `https://api.typesafe.ai` (overridable in the credential), header `Authorization: Bearer <key>`.
- `GET /v1/models` → `{ "models": [ { "name": "jev-latest" }, ... ] }`.
- `POST /v1/systemone` with `{ state, model, questions }`. `model` is required (422 without it); the node defaults to `jev-latest`. Question shapes:

| Type | `criteria` |
|------|-----------|
| `noul` | optional `{ "true": text, "false": text }` |
| `choice` | `{ label: description \| null }`, at least two labels |
| `score` | ordered array, index = score, at least two levels |

- Response `{ model, usage: { input_tokens, output_tokens }, answers: { name: typed answer } }`; request id in the `x-typesafe-request-id` header. 401 = bad key, 429 carries `Retry-After`.

### Node output (internal contract, consumed by downstream workflow nodes)

```json
{ "...input fields": "(unless Include Input Fields is off)",
  "typesafe": { "model": "...", "usage": {}, "answers": {} },
  "results":  { "category": "billing", "urgency": 1.38, "needsReply": 0.99 } }
```

`results`: choice → label, score → expected score, noul → probability of yes. Changing this shape breaks users' Switch nodes, so it is versioned with the node `version`.

### Form syntax

Labels: one per line or comma-separated, `label = description` to describe. Rubric: one level per line, lowest first. Raw questions JSON (Options) is merged over the form; same name → raw wins.

## Cross-cutting standards

| Concern | Standard |
|---------|----------|
| Auth | Only through the n8n credential and `httpRequestWithAuthentication`; the node never reads or logs the key |
| Errors | Validation → `NodeOperationError` with `itemIndex`; HTTP failures → `NodeApiError`; "Continue On Fail" yields `{ error }` with `pairedItem` |
| Retries / timeouts | No retry loop in the node; users enable n8n "Retry On Fail". Per-request timeout option, default 60 s |
| Item linking | Every output sets `pairedItem` |
| Lint | `eslint-plugin-n8n-nodes-base` rules; suppressions must carry a reason |
| Testing | Pure logic lives in `questions.ts` so it can be unit-tested without n8n; wire shapes checked by `npm run smoke`. No unit tests yet |
| Compatibility | `n8nNodesApiVersion: 1`, Node ≥ 20.15, `n8n-workflow` as a peer dependency |

---
*Last reviewed: 2026-09-19*
