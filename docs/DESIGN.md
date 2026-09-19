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
- Credential `typeSafeApi`: `apiKey` (password), `baseUrl` (default above). Generic Bearer auth; credential
  test hits `/v1/models`. The test's `baseURL` is an expression that repeats the node's own normalisation
  (`(($credentials.baseUrl || "").trim() || "https://api.typesafe.ai").replace(/\/+$/, "")`) so a cleared
  or space-padded field is tested against the public API instead of failing with `ERR_INVALID_URL`, and
  `test.rules` turn 401/403 into "Check your TypeSafe API key…" instead of the bare HTTP status text.
- Node `typeSafe`, operations:
  - `systemOne` (default): State Type text|json, State, Model (dropdown loaded from `/v1/models`, blank = `jev-latest`), Questions fixedCollection with three row types (noul / choice / score), Options: raw questions JSON (merged over the form), include input fields (default on), timeout.
  - `listModels`: one item per model.
- Output per input item:
  ```json
  { ...input fields, "typesafe": { "model", "usage", "answers", "requestId" }, "results": { "category": "billing", "urgency": 1.38, "needsReply": 0.99 } }
  ```
  `results` is the routing-friendly flattening: choice → label, score → number, noul → probability. A
  known answer type missing its value field flattens to `null`, never `undefined`, so the key survives
  n8n's JSON serialisation. `typesafe.requestId` is the `x-typesafe-request-id` response header, added
  2026-09-19; it is absent when the API does not send one, and everything else in the shape is unchanged.
- **Label syntax** in the form: one label per line, **or** comma-separated when the field is a single
  line. The separator is chosen per field, not per line: as soon as the Labels field contains a line
  break, only line breaks separate labels, so commas on those lines are ordinary text. That is what
  lets a description hold a comma — `billing = invoices, refunds` on its own line is one label with the
  description `invoices, refunds`, which is the wire example above. `label = description` describes a
  label (first `=` only, so a description may contain `=`); an empty description means `null`. A label
  with nothing before its `=`, and a label listed twice, are both errors. Rubric: one level per line,
  lowest first (commas are never separators there).
- Errors: validation problems (question names, label/rubric counts, duplicate labels, unparsable JSON in
  State (JSON) or Questions (Raw JSON), no questions at all) are `NodeOperationError` with the item
  index and a description; HTTP failures keep the `NodeApiError` n8n raised, including its status and
  the API's own response body under `context.data`. Both honour "Continue On Fail", which yields
  `{ error, errorDescription?, errorHttpCode? }` with `pairedItem` kept, where `errorDescription`
  prefers the API's own message (`detail.message`, or the FastAPI-style `detail[].msg` list), then the
  error's own description, then — for DNS/timeout failures, where n8n replaces the message with a
  generic one and keeps the real cause in `error.messages` — the first of those messages
  ("timeout of 2000ms exceeded", "getaddrinfo ENOTFOUND …").

## Installing on automation.biztactix.com.au
Self-hosted n8n installs community nodes from **Settings → Community Nodes → Install** by npm package name, so
publishing `@biztactix/n8n-nodes-typesafe` is the clean path. Requires `N8N_COMMUNITY_PACKAGES_ENABLED` not set to false (default allows).
Alternatives if we don't want to publish yet:
- `npm pack`, copy the `.tgz` into the container, `npm install /path/file.tgz` inside `~/.n8n/nodes`, restart n8n;
- or mount the built package into the custom extensions dir and set `N8N_CUSTOM_EXTENSIONS=/path`.
Which one depends on how the instance is deployed (Coolify/Docker Compose/other). **Unknown as of writing — ask Farhan.**

## Try it in n8n (local harness)
`npm run n8n:dev` is the one command: it builds the package, links `dist/` into an isolated n8n user
folder and starts n8n in the foreground on <http://localhost:5678>.

- **Where data lives.** `.n8n-dev/` in the repo (gitignored, and excluded from the tarball). `N8N_USER_FOLDER`
  points at it, so the sqlite database, encryption key and settings are there and the real `~/.n8n` is
  never touched. The frontend caches its generated `types/nodes.json` and `types/credentials.json`
  under `.n8n-dev/.cache/n8n/public/types/`, which is the quickest way to check what n8n loaded.
- **How the node is loaded.** `.n8n-dev/custom/n8n-nodes-typesafe` is a symlink to `dist/`, and
  `N8N_CUSTOM_EXTENSIONS` points at `.n8n-dev/custom`. n8n's `CustomDirectoryLoader` globs
  `**/*.node.js` and `**/*.credentials.js` under that directory, so linking `dist/` rather than the repo
  root keeps `node_modules/` and `dist-test/` out of the scan. Custom-directory nodes are namespaced
  `CUSTOM.`, so the node appears as `CUSTOM.typeSafe` (published/community installs use the package
  name and the `n8n` block in package.json instead).
- **n8n version.** Not a dependency of this package (no runtime deps); the script runs
  `npx n8n@2.39.8`, which caches in `~/.npm/_npx`. First run downloads ~2.8 GB and takes several
  minutes; later runs start in seconds. Override with `N8N_DEV_VERSION=x.y.z`, and the port with
  `N8N_PORT=...`. Verified working on 2.39.8 with Node 24.18.0 (n8n 2.x requires Node >= 24).
- **Credentials.** Add the API key in the n8n UI under Credentials → TypeSafe AI API. The harness never
  reads or prints a key, and nothing sensitive is written into the repo.
- **What is already in there.** After US-TSN-1-5 the instance has an owner account, six credentials
  (one real, five deliberately broken) and the verification workflows. `.n8n-dev/README.local.md`
  (gitignored) lists the login, the credential and workflow ids, and the REST calls used to drive them.
- **How to stop.** Ctrl-C in the foreground (the script forwards the signal to the whole n8n process
  group, so nothing is left holding port 5678).
- **How to reset.** Delete `.n8n-dev/` for a clean instance — new database, new encryption key, no
  owner account. The npx cache is separate, so the next start is still fast.

## Verified in n8n 2.39.8 (2026-09-19)

Driven through n8n's internal REST API (owner setup → credentials → `POST /rest/workflows` →
`POST /rest/workflows/:id/run` → execution data) against the live API, with the node loaded from
`.n8n-dev/custom` as `CUSTOM.typeSafe`. Keys are never shown below; `req_…` ids and key values are
redacted.

### Cases

| # | Case | Result |
|---|------|--------|
| 1 | Node and credential load | `CUSTOM.typeSafe` v1 "TypeSafe AI" and `typeSafeApi` "TypeSafe AI API" both appear in n8n's generated types |
| 2 | Credential test, good key | `status: OK`, "Connection successful!" |
| 3 | Credential test, bad key | `status: Error` (message since US-TSN-1-3: "Check your TypeSafe API key: the API rejected it (401 Unauthorized)."; was n8n's bare "Unauthorized") |
| 4 | Credential test, unreachable base URL | `status: Error`, "ENOTFOUND" |
| 5 | Credential test, reachable base URL with no `/v1/models` | `status: Error`, "Not Found" |
| 6 | Model dropdown (`getModels`) | `jev-latest`, `jev-preview` |
| 7 | Model dropdown, bad key | NodeApiError "Authorization failed - please check your credentials", 401, API detail in `context.data` |
| 8 | Model dropdown, blank Base URL in the credential | falls back to `https://api.typesafe.ai`, lists both models (was: "Invalid URL") |
| 9 | List Models | one item per model (`name`, `description`, `release_date`) |
| 10 | List Models, three input items | two items, each `pairedItem: [{item:0},{item:1},{item:2}]` (was: no `pairedItem` at all) |
| 11 | List Models, bad key, Continue On Fail | one error item instead of failing the workflow (was: Continue On Fail ignored) |
| 12 | Text state, noul + choice + score, model blank | 200, `results` = `{needsReply: 0.94, category: "billing", urgency: 2.01}`, `typesafe.model` `jev-1.13.0`, `typesafe.requestId` present |
| 13 | JSON state from `={{ $json }}` | 200, whole input item sent as the state |
| 14 | JSON state typed as a literal string | 200, parsed and sent as an object |
| 15 | Three input items | three output items, `pairedItem` 0/1/2, one request each |
| 16 | Explicit model `jev-preview` + Include Input Fields off | 200, output holds only `typesafe` and `results` |
| 17 | Raw questions JSON overlay | adds `language`, and wins over the form's `isSpam` |
| 18 | Raw overlay name with spaces / blank | trimmed to `isSpam` / "Every question needs a name." (was: used verbatim) |
| 19 | Choice description containing a comma | `criteria.billing = "invoices, payments and refunds"` (was: a bogus extra label `payments and refunds`, which the model then *chose*) |
| 20 | Duplicate choice labels | "Choice question "category" lists the label "billing" twice." (was: "needs at least two labels") |
| 21 | Label line starting with `=` | "…has a label with nothing before the "=" ("= no label")." (was: an empty-string label sent to the API) |
| 22 | Choice with one label / score with one level | "…needs at least two labels." / "…two rubric levels, one per line.", with the **trimmed** name |
| 23 | Blank question name | "Every question needs a name." as a NodeOperationError (was: NodeApiError) |
| 24 | Zero questions | "Add at least one question." with a description |
| 25 | Malformed Questions (Raw JSON) | `"Questions (Raw JSON)" is not valid JSON: …` (was: a bare `SyntaxError` message wrapped as an API error) |
| 26 | Malformed State (JSON) | `"State (JSON)" is not valid JSON: …` |
| 27 | Empty State (JSON) | `"State (JSON)" is empty.` (was: `state` dropped from the body → API 422) |
| 28 | Empty State (text) | n8n's own required-parameter check: "Parameter "State" is required." |
| 29 | Bad key at execution | NodeApiError, 401, `context.data.detail.message` preserved |
| 30 | Unreachable base URL at execution | NodeApiError, ENOTFOUND |
| 31 | Base URL that answers but has no route | NodeApiError, 405 |
| 32 | Unknown model | NodeApiError 400; Continue On Fail item carries "Unknown model: no-such-model" |
| 33 | Timeout 2 s against a black-hole host | NodeApiError, `httpCode` ECONNABORTED; n8n's own message is generic ("The connection was aborted…") and "timeout of 2000ms exceeded" comes from `error.messages` |
| 34 | Timeout 0 | falls back to 60 s (was: axios treated 0 as "no timeout" and the item hung until the execution was cancelled by hand) |
| 35 | Continue On Fail, good + blank-name items | good items normal, bad item `{error, errorDescription}` with `pairedItem: {item: 1}` |
| 36 | Continue On Fail, bad key | `{error: "Authorization failed…", errorDescription: "Cannot authenticate with the server…", errorHttpCode: "401"}` (was: message only) |
| 37 | API 422/400 body, Continue On Fail | `errorDescription` is the API's own text, e.g. "Noul question must have criteria or instructions: q" |
| 38 | State from a previous node's field (`={{ $json.text }}`) | used throughout the cases above |

### Defects fixed

1. A comma inside a choice description became a second label (case 19) — the node's own placeholder,
   `billing = invoices, payments and refunds`, produced the bogus label and the model picked it.
   Labels now split on line breaks only when the field has any; a single line still splits on commas.
2. Duplicate labels collapsed silently and then reported the wrong error (20).
3. A label line starting with `=` produced an empty-string label (21).
4. For choice and score the list-length check ran before the name check and interpolated the untrimmed
   name (22).
5. noul `When True` / `When False` were never trimmed, so whitespace-only text reached the wire.
6. Raw-overlay question names were neither trimmed nor checked for blankness (18).
7. `flattenAnswers` produced `undefined` for an answer missing its value field, which drops the key
   when n8n serialises the item; it now produces `null`.
8. Every validation failure surfaced as a `NodeApiError` with a null HTTP code (20, 23, 25, 26); they
   are now `NodeOperationError` with `itemIndex` and a description.
9. Re-wrapping n8n's own `NodeApiError` threw away the API's response body. The node now tags the
   original error with the item index instead. `instanceof` is not enough for this: a node loaded from
   a custom-extensions directory resolves its own copy of `n8n-workflow`, so the class object n8n
   threw is a different one — the check falls back to `error.name`.
10. "Continue On Fail" items carried only the message; they now carry the API's own explanation and the
    HTTP status (36, 37).
11. `List Models` ignored "Continue On Fail" and emitted items with no `pairedItem` (10, 11).
12. A blank Base URL in the credential produced "Invalid URL"; it now falls back to the public API, and
    a trailing slash is trimmed (8).
13. A Timeout of 0 meant "no timeout" and hung the item (34). The field now has `minValue: 1` and the
    code treats 0, a negative number and a blank as the 60 s default.
14. UI polish: the subtitle showed the raw parameter value (`systemOne`) and now reads "ask questions" /
    "list models"; the Options collection is alphabetical; `List Models` and the three `Question` fields
    gained descriptions; the dead `requestDefaults` block (only meaningful for declarative nodes, and
    never used because `execute()` sets `baseURL` itself) was removed.

### Deliberately left

- `flattenAnswers` passes an answer of an unknown type through **by reference**, so `results.<name>` and
  `typesafe.answers.<name>` share one object. n8n deep-copies items between nodes, so nothing downstream
  can observe the aliasing; copying would only cost time. Pinned by a test.
- The documented output contract (`{...input, typesafe, results}`) and the operation/parameter names are
  unchanged (DECISIONS D-005). `typesafe.requestId` and the `errorDescription` / `errorHttpCode` keys on
  a Continue-On-Fail item are the only additions, and both are additive.
- `model` is a `type: 'options'` field with an empty default. A blank value means `jev-latest`, which is
  not obvious in the UI, but making the default `jev-latest` would send a hard-coded model that the API
  could retire. **Open question:** is a dropdown with an explicit "(default) jev-latest" entry better?
- `typesafe.model` is the API's response `model`, which is the **resolved version** (`jev-1.13.0` today)
  whatever alias was asked for: the API resolves both `jev-latest` and `jev-preview` to the same version,
  so an output item cannot show which alias the node sent, and no case in the table above should be read
  as proving one. Left as is on purpose — echoing the requested alias would mean inventing a field the
  API does not return, and the request is already reproducible from the node parameters. Confirmed again
  in US-TSN-1-2 (explicit `jev-preview` still returned `jev-1.13.0`).
- No `usableAsTool` flag yet: exposing the node to n8n's AI Agent is a separate decision.

### Re-verified by US-TSN-1-1 / 1-2 / 1-3 (2026-09-19)

Three independent re-runs against a fresh local n8n 2.39.8, each building its own workflows over the
REST API and deleting them afterwards. Nothing in the table above was contradicted.

- **US-TSN-1-1** — the node, the credential type and the icon are served by a running n8n; credential
  test passes with a good key and fails with a bad or empty one. Found **F1** below.
- **US-TSN-1-2** — happy paths re-run from scratch (text and JSON state, all three question types,
  three items, explicit model, model dropdown, List Models): 91 assertions, all passing. Noted **F3**.
- **US-TSN-1-3** — errors: nine validation cases and six API-failure cases, each run with "Continue On
  Fail" off and on (30 executions, 179 assertions, all passing). Every item-dependent validation case
  was driven from an expression so that only the **second** of three input items was broken:
  off → the execution fails with a `NodeOperationError` whose `context.itemIndex` is 1; on → items 0
  and 2 still return normal answers and item 1 is `{error, errorDescription}` with
  `pairedItem: {item: 1}`, execution status `success`. Cases: blank question name, choice with one
  label, duplicate labels, a label line starting with `=` on a later line, score with one rubric level,
  zero questions (node-wide, so all three items fail at `itemIndex` 0), malformed Questions (Raw JSON),
  a raw question with no `type`, malformed State (JSON); then bad key (401), unknown model (400),
  unreachable host (ENOTFOUND), reachable host with no route (405), 2 s timeout against a black-hole
  host (ECONNABORTED), and List Models with a bad key (one error item whose `pairedItem` lists every
  input item). API failures are `NodeApiError` with the HTTP status in `httpCode` and the API's own
  text preserved (`context.data.detail.message`, and `errorDescription` on a Continue-On-Fail item —
  e.g. "Unknown model: no-such-model", "Cannot authenticate with the server…").

**F1 (fixed).** The credential test sent `={{$credentials.baseUrl}}` raw, so a cleared Base URL failed
with `ERR_INVALID_URL` while the node's execute path happily fell back to `https://api.typesafe.ai`.
The test now uses the same expression-level fallback and trailing-slash trim as the node
(`credentials/TypeSafeApi.credentials.ts`); n8n's expression engine accepts the `.trim()`, `||` and
`.replace(/\/+$/, "")` in a credential test `baseURL`. Live after the fix: blank, whitespace-only,
trailing-slash and triple-trailing-slash Base URLs all give "Connection successful!", and good key /
bad key / unreachable / no-route still behave as before.

**F2 (fixed).** A failed credential test used to show only the HTTP status text ("Unauthorized",
"Forbidden"). `ICredentialTestRequest.rules` does work in 2.39.8 (`credentials-tester.service`
matches `type: 'responseCode'` against `error.cause.response.status` before falling back to the status
text), so 401 and 403 now read "Check your TypeSafe API key: …". Proven live. **Known limitation:**
`rules` only match HTTP status codes, so transport failures still surface as the bare Node error code
(`ENOTFOUND`), and there is no hook to rewrite those.

**F3 (recorded, no code change).** See "Deliberately left" above: `typesafe.model` is the resolved
version, not the requested alias.

**New defect found and fixed (15).** On a DNS or timeout failure n8n replaces the error message with a
generic one ("The connection was aborted, perhaps the server is offline") and keeps the real cause in
`error.messages`; the node dropped it, so a "Continue On Fail" item said only that something was
aborted. `errorItem` now falls back to the first of `error.messages`, so the item carries
`errorDescription: "timeout of 2000ms exceeded"` / `"getaddrinfo ENOTFOUND no-such-host.invalid"`
alongside `errorHttpCode`. Verified live for both cases, off and on.

**Left as is.** The error-item shaping (`errorItem`, `apiDetail`, `transportDetail`) lives in
`TypeSafe.node.ts` rather than `questions.ts` and is not exported, so it is covered by the live n8n
evidence above rather than by unit tests; exporting node internals only to test them was judged worse
than the live coverage (`.project/DECISIONS.md` D-010 keeps the unit tests on the pure functions).

## Starter workflows (examples/)
Two importable variants of the same shape: trigger → TypeSafe AI (category, urgency, needsReply) →
Switch on `{{ $json.results.category }}` → one branch per team. Neither file carries credential ids,
names or data: pick the credential in n8n after importing.

| File | Trigger | Notes |
|------|---------|-------|
| `email-classifier.workflow.json` | `n8n-nodes-base.emailReadImap` v2, `format: simple` | State is `From:` + `Subject:` + `textPlain \|\| text`. Switch v3.2, three rules (billing/support/sales) with the fourth branch as the `extra` fallback output. |
| `email-classifier-outlook.workflow.json` | `n8n-nodes-base.microsoftOutlookTrigger` v1, `output: simple`, `filters.readStatus: unread`, `pollTimes` every minute | State is `Subject:` + `bodyPreview` only. Switch v3.4 (the default version in 2.39.8), four rules (billing/support/sales/spam) plus a named `extra` fallback output ("unmatched"). |

**Why the Outlook state is subject + body preview only.** The trigger's simplified output is
`id, conversationId, subject, bodyPreview, from, to, categories, hasAttachments`; the state sends the
two content fields and nothing else — no sender/recipient addresses, no attachments, no full headers
— which is the minimisation the security doc asks for (PII Handling). Swap `bodyPreview` for the full
`body.content` (Output → Raw or Select Included Fields) only if the questions need more than the
preview, and re-read that note first.

The categories in both examples are placeholders (billing / support / sales / spam). **Real
categories still to be confirmed with Farhan** (`.project/DECISIONS.md` D-006).

Both files name the node as `@biztactix/n8n-nodes-typesafe.typeSafe`, which is how it resolves once
the package is installed from npm. In the local harness the same node is loaded from the custom
extensions directory and is therefore `CUSTOM.typeSafe`, so a workflow imported there shows the node
as unrecognised until the type is renamed — an artefact of the harness, not of the example.

**Import check (2026-09-19, n8n 2.39.8).** `POST /rest/workflows` with
`email-classifier-outlook.workflow.json` created the workflow with all eight nodes; parameters and
connections came back byte-identical. `POST /rest/node-types` resolved every base type in the file
(`microsoftOutlookTrigger` v1, `switch` v3–3.4, `noOp` v1); the TypeSafe node resolves as
`CUSTOM.typeSafe` v1 in the harness and the published name the file carries is an "Unrecognized node
type" there, which is the rename artefact described above and does not stop the import. Every
parameter name matched a property in the live node description. The imported copies were archived
and deleted again; no workflow was executed, so the check made no TypeSafe API calls.

**Independent re-check (US-TSN-4-1, 2026-09-19).** Both example files, verbatim and with the node
type rewritten to `CUSTOM.typeSafe`, were imported into a fresh run of the harness: four imports,
all `200`, every node stored, and `parameters`, `type`, `typeVersion` and `connections` identical to
the file on read-back. Every TypeSafe parameter key matched a property that is visible for
`operation: systemOne`, and every question row's fields matched that row type's `values`. Routing was
then proved end to end: a mocked email item (invented content) through the Outlook example's own
TypeSafe and Switch nodes gave `results = {category: "billing", urgency: 1.27, needsReply: 0.94}` and
the item left the Switch on output 0 → **Billing** (one live API call). A second run with fabricated
answers and no API call sent `category: "legal"` out of output 4 → **Unmatched**, so the fallback
branch is wired and reachable. Defect found and fixed: `email-classifier.workflow.json` still carried
a `credentials` block (`typeSafeApi`, empty id, credential name), which contradicted the "no
credential ids, names or data" promise above and in the README; it was removed.

## CI (.github/workflows/ci.yml)
Triggers on push to `main` and on pull requests to `main`. One job, `check`, on `ubuntu-latest`, over a
`node-version` matrix of `20.x` (the floor in `package.json` engines, `>=20.15`) and `24.x` (the current
LTS, Krypton, and what the dev box runs), `fail-fast: false` so one version's failure still reports the
other. Steps: `actions/checkout@v7`, `actions/setup-node@v7` with `cache: npm` (keyed off
`package-lock.json`), then `npm ci --ignore-scripts`, `npm run lint`, `npm run build`, `npm test`.
`permissions: contents: read` and a `cancel-in-progress` concurrency group per ref.

**No secrets and no live API calls.** `npm run smoke` needs `TYPESAFE_API_KEY` and stays a manual,
local step; CI covers only the pure `questions.ts` unit tests, the compile and the n8n lint rules.

**Why `--ignore-scripts`.** `isolated-vm@6.2.0`, a transitive dependency of `n8n-workflow`, has an
`install` script that falls back to a native `node-gyp` build, and its sources do not compile against
Node 20's V8 headers (`v8::SourceLocation` does not exist there), so a plain `npm ci` fails outright on
Node 20 — reproduced locally on a clean install under Node 20.20.2. Nothing in lint, build or test
needs any dependency's install script: the package depends on `n8n-workflow` for types only and ships no
runtime dependency. Skipping them is also one less arbitrary-code path in CI. Verified: the full
`npm ci --ignore-scripts` → lint → build → `npm test` sequence passes from a clean checkout on both
Node 20.20.2 and Node 24.18.0 (83 tests).

## Release (.github/workflows/release.yml)
Triggers on pushed tags matching `v*.*.*` and on nothing else — merging to `main` never publishes.
One job, `publish`, on `ubuntu-latest`, on Node `24.x` only: this job builds the single tarball that
ships, the emitted JavaScript is decided by `tsc`'s target rather than by the Node that ran it, and
`ci.yml` already proves the package on the `>=20.15` floor on every push.

Steps, in order: `actions/checkout@v7`; `actions/setup-node@v7` with `cache: npm` and
`registry-url: https://registry.npmjs.org` (which writes the `.npmrc` auth line that reads
`NODE_AUTH_TOKEN`; the default-registry line covers the `@biztactix` scope, so no `scope` input is
needed); **the tag/version guard**; `npm ci --ignore-scripts`; `npm run lint`; `npm run build`;
`npm test`; `npm publish --access public --provenance` with `NODE_AUTH_TOKEN` from `secrets.NPM_TOKEN`.

**The guard runs first**, before install or build, so a mismatch costs nothing and nothing can reach
the registry: it compares `${GITHUB_REF_NAME#v}` with `node -p "require('./package.json').version"`
and fails the job with a `::error::` annotation if they differ. Verified locally against the current
`0.1.0` manifest: `v0.1.0` passes, `v0.2.0`, `v10.1.0` and `v0.1.0-rc.1` all exit 1.

**Provenance.** `--provenance` needs `permissions: id-token: write` (npm exchanges the Actions OIDC
token with Sigstore) and, for a scoped package that is not yet public, `--access public` — npm refuses
provenance otherwise. The registry also requires `package.json`'s `repository.url` to name the repo the
workflow ran in; it is `https://github.com/Biztactix/n8n-nodes-typesafe.git`, which matches.

**`--ignore-scripts` on install, not on publish.** The flag is per-invocation and no `.npmrc` sets
`ignore-scripts`, so `npm publish` still runs this package's own `prepublishOnly` (`npm run build`) —
confirmed in npm 11's `lib/commands/publish.js`, which runs `prepublishOnly` for a directory publish
unless the `ignore-scripts` config is on. The tarball therefore always carries a `dist/` rebuilt from
the tagged commit. `npm pack --dry-run` on the built tree lists exactly `LICENSE`, `README.md`,
`index.js`, `package.json` and the ten `dist/` files — 14 files, ~12 kB packed: no sources, no tests,
no `.n8n-dev/`, no secrets. (`index.js` is not in `files`; npm always ships the `main` entry.)

**Approval and secrets.** The job declares `environment: npm`, so a required-reviewer protection rule
on that environment (repo Settings → Environments) makes every publish wait for Farhan's approval.
The environment and the `NPM_TOKEN` secret (an npm automation token for the `@biztactix` scope) are
not yet created — both are manual, one-time repo-settings steps. Concurrency uses
`cancel-in-progress: false`: a release already in flight is never cancelled by a later tag.

**Deliberately left as-is** (reviewed 2026-09-19, US-TSN-3-2; each is a call for Farhan, not a bug):
- *Actions pinned to majors (`@v7`), not SHAs.* A major tag is mutable, so a compromised or
  force-moved tag would run in a job that can mint an OIDC token and see `NPM_TOKEN`. SHA pinning
  removes that at the cost of a Dependabot-shaped upgrade chore on a two-workflow repo. Left on
  majors; revisit if the package gets wider use.
- *Any tag on any commit can start a release.* GitHub cannot restrict a tag trigger to commits on
  `main`. The cheap mitigation is the `npm` environment's "Deployment branches and tags" rule set to
  `v*.*.*`; a stronger one is a `git branch --contains "$GITHUB_SHA" origin/main` step (needs
  `fetch-depth: 0`). Neither is in place; the required reviewer is the current control.
- *Self-approval.* Farhan both pushes the tag and approves the environment, so the gate is a
  deliberate pause, not separation of duties. GitHub's "prevent self-review" option would change that
  and would also mean no release without a second person.
- *Prerelease tags publish to `latest`.* `v0.2.0-rc.1` matches the trigger and passes the guard if
  `package.json` says `0.2.0-rc.1`, and `npm publish` with no `--tag` would make the rc the default
  install for n8n users. No prerelease is planned; if one is, add `--tag next`.
- *The guard runs inside the gated job*, so a mismatched tag still costs an approval click before it
  fails. Splitting a gate-free `verify` job from a `publish` job that `needs:` it would fix that at
  the cost of a second checkout.

## Open questions
1. How n8n is deployed at automation.biztactix.com.au (decides publish vs mount).
2. The real email categories and any extra per-email questions (urgency scale, needs-reply, sentiment).
3. Which mailbox/trigger: IMAP, Microsoft 365, Gmail.
4. Whether to publish under the `@biztactix` npm scope or unscoped `n8n-nodes-typesafe` (unscoped is what n8n's verified list expects).

## Roadmap
- [x] Scaffold: credential, node, question builder, smoke script, starter workflow (2026-09-19). `npm run build` and `npm run lint` clean; `npm run smoke` passed against the live API (200, shapes as documented above). Not yet loaded inside n8n.
- [x] Try inside a local n8n and fix UI issues (2026-09-19) — see "Verified in n8n 2.39.8" below.
- [x] Unit tests for `questions.ts` (`node:test`, compiled to `dist-test/`; 83 tests).
- [x] Lint clean under `eslint-plugin-n8n-nodes-base` (one documented suppression on the credential docs URL).
- [~] CI: lint + build + tests on push and PR — `.github/workflows/ci.yml` written and verified locally (2026-09-19), not yet pushed, so it has never run on GitHub.
- [~] Release on tag: `.github/workflows/release.yml` publishes to npm with provenance on a `v*.*.*` tag (2026-09-19). Written and checked locally (actionlint clean, guard logic exercised, `npm pack --dry-run` tarball verified); never run, nothing published. Still needs the `NPM_TOKEN` secret and the `npm` environment with a required reviewer, both created by Farhan in repo settings.
- [ ] Install on automation.biztactix.com.au and wire the real email workflow.
- [ ] Later: batch mode (many items per request if the API adds it), Typed enum helpers, retries-after header awareness.
