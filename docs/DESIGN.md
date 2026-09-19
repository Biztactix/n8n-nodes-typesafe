# Design: TypeSafe AI node for n8n

_Written 2026-09-19 from the planning conversation in the C# SDK repo. This is the brief the first coding session works from._

## Goal
Let n8n workflows call TypeSafe AI without hand-written HTTP. First consumer: Biztactix's n8n at
`automation.biztactix.com.au`, where inbound email should be classified as the first step (which team,
how urgent, does it need a reply) and routed with a Switch node.

## Why a node and not the HTTP Request node
The HTTP Request node works today: Bearer credential, a JSON body with `state` and `questions`, a Set
node to pull out answers. It was the ten-minute route. A community node is better long-term because:
- the key is a proper n8n credential type, reused across workflows and testable from the UI;
- questions are built in a form (name, type, labels/rubric) instead of pasted JSON, so non-developers can edit them;
- answers are flattened to `results.<name>` so Switch/IF nodes route on them directly;
- one node per workflow instead of copied JSON, and the package can be public because it holds no secrets.

## Wire format (from the C# SDK, `src/TypeSafe.Sdk/Constants.cs` and `Questions.cs`)
- Base URL `https://api.typesafe.ai`, header `Authorization: Bearer <key>`.
- `GET /v1/models` → `{ "models": [ { "name": "jev-latest" }, ... ] }`. Seen live: `jev-latest`, `jev-preview`; default resolves to `jev-1.13.0`.
- `POST /v1/systemone` body:
  ```json
  {
    "state": "text, or a JSON object/array",
    "model": "jev-latest",
    "questions": {
      "needsReply": { "type": "noul",   "instructions": "Does this need a human reply?", "criteria": { "true": "...", "false": "..." } },
      "category":   { "type": "choice", "instructions": "Which team?", "criteria": { "billing": "invoices, refunds", "support": null } },
      "urgency":    { "type": "score",  "instructions": "How urgent?", "criteria": ["can wait", "today", "right now"] }
    }
  }
  ```
  `model` is **required** (a request without it is a 422 `Field required`); the SDKs default it to `jev-latest` and so does the node. `criteria` is optional on noul, a label→description map (null = undescribed) on choice, and an ordered
  array (index = score) on score. `type` must be first only for the C# serializer; the API does not care.
- Response:
  ```json
  {
    "model": "jev-1.13.0",
    "usage": { "input_tokens": 382, "output_tokens": 78 },
    "answers": {
      "needsReply": { "type": "noul",   "noul": 0.99 },
      "category":   { "type": "choice", "choice": "billing", "confidence": 1.0, "probabilities": { "billing": 1.0, "support": 0.0 } },
      "urgency":    { "type": "score",  "score": 1.38, "confidence": 0.43, "legend": { "0": "can wait", "1": "today" }, "probabilities": { "0": 0.0, "1": 0.62, "2": 0.38 } }
    }
  }
  ```
  Request id comes back in the `x-typesafe-request-id` response header. Errors: 401 for a bad key; 429 carries `Retry-After`. The SDKs retry 408/409/429/5xx with backoff; in n8n use the node's built-in "Retry On Fail" setting rather than re-implementing that.

## Node design
- Credential `typeSafeApi`: `apiKey` (password), `baseUrl` (default above). Generic Bearer auth; credential test hits `/v1/models`.
- Node `typeSafe`, operations:
  - `systemOne` (default): State Type text|json, State, Model (dropdown loaded from `/v1/models`, blank = `jev-latest`), Questions fixedCollection with three row types (noul / choice / score), Options: raw questions JSON (merged over the form), include input fields (default on), timeout.
  - `listModels`: one item per model.
- Output per input item:
  ```json
  { ...input fields, "typesafe": { "model", "usage", "answers" }, "results": { "category": "billing", "urgency": 1.38, "needsReply": 0.99 } }
  ```
  `results` is the routing-friendly flattening: choice → label, score → number, noul → probability.
- Label syntax in the form: one per line or comma-separated; `label = description` describes it. Rubric: one level per line, lowest first.
- Errors: `NodeApiError` per item, honours "Continue On Fail".

## Installing on automation.biztactix.com.au
Self-hosted n8n installs community nodes from **Settings → Community Nodes → Install** by npm package name, so
publishing `@biztactix/n8n-nodes-typesafe` is the clean path. Requires `N8N_COMMUNITY_PACKAGES_ENABLED` not set to false (default allows).
Alternatives if we don't want to publish yet:
- `npm pack`, copy the `.tgz` into the container, `npm install /path/file.tgz` inside `~/.n8n/nodes`, restart n8n;
- or mount the built package into the custom extensions dir and set `N8N_CUSTOM_EXTENSIONS=/path`.
Which one depends on how the instance is deployed (Coolify/Docker Compose/other). **Unknown as of writing — ask Farhan.**

## Starter workflow (examples/email-classifier.workflow.json)
Email trigger (IMAP; swap for Gmail/Outlook trigger as needed) → TypeSafe AI (category, urgency, needsReply) → Switch on `{{ $json.results.category }}` → one branch per team. The categories in the example are placeholders (billing / support / sales / spam). **Real categories still to be confirmed with Farhan.**

## Open questions
1. How n8n is deployed at automation.biztactix.com.au (decides publish vs mount).
2. The real email categories and any extra per-email questions (urgency scale, needs-reply, sentiment).
3. Which mailbox/trigger: IMAP, Microsoft 365, Gmail.
4. Whether to publish under the `@biztactix` npm scope or unscoped `n8n-nodes-typesafe` (unscoped is what n8n's verified list expects).

## Roadmap
- [x] Scaffold: credential, node, question builder, smoke script, starter workflow (2026-09-19). `npm run build` and `npm run lint` clean; `npm run smoke` passed against the live API (200, shapes as documented above). Not yet loaded inside n8n.
- [ ] Try inside a local n8n (`npx n8n` with the package linked into `~/.n8n/custom`) and fix UI issues.
- [ ] Unit tests for `questions.ts` (vitest or node:test).
- [x] Lint clean under `eslint-plugin-n8n-nodes-base` (one documented suppression on the credential docs URL).
- [ ] CI: build + lint + tests; release on tag to npm.
- [ ] Install on automation.biztactix.com.au and wire the real email workflow.
- [ ] Later: batch mode (many items per request if the API adds it), Typed enum helpers, retries-after header awareness.
