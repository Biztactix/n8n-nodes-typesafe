# n8n-nodes-typesafe

An [n8n](https://n8n.io) community node for [TypeSafe AI](https://typesafe.ai). Ask yes/no (noul),
choice and score questions about any text or JSON from a workflow and route on the typed answers.

Status: early, not yet published to npm. Exercised end to end in a local n8n 2.39.8 against the live
API (2026-09-19). See [docs/DESIGN.md](docs/DESIGN.md).

## Operations
- **Ask Questions (System One)** – send a state (text or JSON) with named questions (`POST /v1/systemone`);
  get one item per input with `results.<name>` (label, score or probability) plus the full typed answers
  under `typesafe.answers`.
- **List Models** – one item per model the key can use (`GET /v1/models`): `name`, `description`,
  `release_date`.

## Install (self-hosted n8n)

**Settings → Community Nodes → Install → `@biztactix/n8n-nodes-typesafe`.** This is the intended route,
and it needs `N8N_COMMUNITY_PACKAGES_ENABLED` not set to `false` on the instance. The package is not
published yet, so until it is, use one of the fallbacks below.

| Fallback | How |
|----------|-----|
| Tarball | `npm run build && npm pack` here, copy `biztactix-n8n-nodes-typesafe-<version>.tgz` into the n8n container, `npm install /path/to/that.tgz` inside `~/.n8n/nodes`, restart n8n. On Coolify `~/.n8n` must be a persistent volume or the install is lost on the next redeploy. |
| Custom extensions | Mount the built package somewhere and set `N8N_CUSTOM_EXTENSIONS=/that/path`. n8n scans it for `*.node.js` and `*.credentials.js`, so point it at a directory containing `dist/`, not at a repo root. |

Nodes loaded from a custom-extensions directory are namespaced `CUSTOM.`, so the node type is
`CUSTOM.typeSafe` rather than `@biztactix/n8n-nodes-typesafe.typeSafe`. The example workflows below name
the published type, so under that fallback they import with the TypeSafe node shown as unrecognised
until the type is renamed. `npm run n8n:dev` uses this route for local development.

## Credential

Add a **TypeSafe AI API** credential in n8n and select it on the node:

| Field | Notes |
|-------|-------|
| **API Key** | Required. Your TypeSafe AI key (starts with `apikey_`). Stored encrypted by n8n and sent as `Authorization: Bearer <key>`. |
| **Base URL** | Defaults to `https://api.typesafe.ai`. Override only for a proxy or a non-production environment; a blank field falls back to the default and a trailing slash is trimmed. |

The credential test calls `GET /v1/models`. A 401 or 403 is reported as "Check your TypeSafe API key…";
a host that cannot be reached shows the raw Node error code (`ENOTFOUND`).

## Asking questions

| Parameter | Notes |
|-----------|-------|
| **State Type** | `Text` (default) or `JSON`. |
| **State** | The text the questions are about — an email subject and body, say, usually from an expression. Required when State Type is Text. |
| **State (JSON)** | A JSON object or array; defaults to the expression `{{ $json }}`. Required when State Type is JSON. |
| **Model Name or ID** | Dropdown loaded from `/v1/models`. Leave empty to send `jev-latest`. |
| **Questions** | One row per question — **Yes/No (Noul)**, **Choice** or **Score** — added with "Add Question". |

Every question row has a **Name** (the key the answer comes back under) and a **Question** (the
instructions sent to the model). Names are trimmed; a blank one is an error.

### Yes/No (Noul)
The answer is a probability between 0 and 1. **When True** and **When False** are optional descriptions
of the two outcomes; whitespace-only text is dropped, and if both are empty no `criteria` is sent.

### Choice — the Labels field
The answer is one of the labels. Syntax:

- **One label per line, or comma-separated on a single line.** The separator is chosen per field, not
  per line: as soon as the field contains a line break, only line breaks split it, and commas on those
  lines are ordinary text.
- **`label = description`** describes a label. Only the first `=` separates the two, so a description may
  contain `=`; an empty or whitespace-only description means "no description" (`null` on the wire).
- Labels and descriptions are trimmed and blank lines are dropped. At least two labels are required.

```
billing = invoices, payments and refunds
support = technical problems
sales
```

That is three labels, and `billing`'s description keeps its commas because each label is on its own
line. Written as one comma-separated line it would be four labels instead.

### Score — the Rubric field
One level per line, **lowest first**; the first line is level 0. Commas are never separators there, so a
level may contain one. At least two levels are required. The answer is a number between 0 and the last
level, and it can land between levels (`1.38`).

```
can wait a week
this week
today
right now
```

### Options
| Option | Default | Notes |
|--------|---------|-------|
| **Include Input Fields** | on | Copy the incoming item's fields into the output next to the answers. Turn it off to keep email bodies out of n8n's execution history. |
| **Questions (Raw JSON)** | empty | A raw `questions` object in the API's wire format, merged *over* the form. Each value must be an object with a string `type`. Names are trimmed, and on a name clash the raw question wins. |
| **Timeout (Seconds)** | 60 | Per-request timeout, minimum 1. A blank, zero or negative value means 60 s. |

Raw JSON is the escape hatch for anything the form cannot express:

```json
{
  "language": { "type": "choice", "instructions": "Which language?", "criteria": { "en": null, "de": null } }
}
```

### Validation errors
These fail the item before any request is made (they honour "Continue On Fail" like any other error):

| Message | Cause |
|---------|-------|
| `Every question needs a name.` | A blank Name, in the form or in the raw JSON. |
| `Choice question "category" needs at least two labels.` | Fewer than two labels after splitting. |
| `Choice question "category" lists the label "billing" twice.` | Duplicate label. |
| `Choice question "category" has a label with nothing before the "=" ("= no label").` | A line starting with `=`. |
| `Score question "urgency" needs at least two rubric levels, one per line.` | Fewer than two lines — a comma-separated rubric is one level. |
| `Add at least one question.` | No questions at all. |
| `Raw question "bad" must be an object with a string "type".` | A raw entry that is not a question object. |
| `"State (JSON)" is empty.` / `"State (JSON)" is not valid JSON: …` | Also `"Questions (Raw JSON)" is not valid JSON: …`. |

## Output

One item per input item:

```json
{
  "subject": "Invoice 1042 is wrong",
  "text": "...",
  "typesafe": {
    "model": "jev-1.13.0",
    "usage": { "input_tokens": 382, "output_tokens": 78 },
    "answers": {
      "category": { "type": "choice", "choice": "billing", "confidence": 1.0, "probabilities": { "billing": 1.0, "support": 0.0 } },
      "urgency": { "type": "score", "score": 1.38, "confidence": 0.43, "legend": { "0": "can wait a week", "1": "this week" }, "probabilities": { "0": 0.0, "1": 0.62, "2": 0.38 } },
      "needsReply": { "type": "noul", "noul": 0.99 }
    },
    "requestId": "req_..."
  },
  "results": { "category": "billing", "urgency": 1.38, "needsReply": 0.99 }
}
```

- `results.<name>` is the routing-friendly flattening: **choice → the chosen label**, **score → the
  number**, **noul → the probability of yes**. An answer type the node does not know is passed through
  whole. A known answer missing its value flattens to `null`, never a missing key.
- `typesafe.answers` keeps the full typed answer, including `confidence` and `probabilities` — use those
  for a "not sure" branch rather than trusting a single label.
- `typesafe.model` is the version the API resolved (`jev-1.13.0`), not the alias that was sent.
- `typesafe.requestId` is the `x-typesafe-request-id` response header, useful when asking TypeSafe about
  a call. It is absent if the API does not send one.
- The input fields at the top are there only with **Include Input Fields** on.

Route on it with a Switch node: one rule per label, left value `{{ $json.results.category }}`, a string
*equals* comparison against `billing`, `support`, … plus the fallback output for anything unmatched.
Both example workflows are wired that way — the Outlook one has a rule per label and a separate
`unmatched` fallback, the IMAP one leaves `spam` to the fallback branch.

## Reliability

- **Timeout (Seconds)** bounds each request so a hung call fails that item instead of the execution.
- **Retry On Fail** is an n8n setting on the node's **Settings** tab, not a parameter here. The node does
  no retrying of its own; the API signals rate limits with a 429 and a `Retry-After` header, so a couple
  of retries with a wait is the right shape for a mail workflow.
- **Continue On Fail** (also Settings) turns a failed item into
  `{ "error": "...", "errorDescription": "...", "errorHttpCode": "401" }` instead of stopping the
  workflow, with `pairedItem` preserved. `errorDescription` carries the API's own explanation when there
  is one, or the underlying transport error (`timeout of 2000ms exceeded`, `getaddrinfo ENOTFOUND …`).

## Data and safety

The state is sent to TypeSafe AI, a third party. For inbound mail that means customer PII leaves the
instance, so:

- **Send only what the questions need** — subject and text body, not attachments or full headers. The
  Outlook example sends subject + `bodyPreview` only.
- **TypeSafe's retention and training policy is not confirmed yet.** Check their terms before production
  mail goes through.
- With **Include Input Fields** on, the whole input item is copied into the output and therefore into
  n8n's execution history; turn it off, or set execution pruning on the instance, if that matters.
- **Email text is attacker-controlled input to a model.** Treat `results` as advisory routing only: do
  not let a classification alone trigger a destructive or outbound action (auto-delete, auto-reply with
  data). Keep a fallback branch and a human in the loop for anything high-impact.
- The API key lives only in the n8n credential store. It is never in this repo, the package or the
  example workflows.

## Examples
`examples/email-classifier.workflow.json` – email trigger (IMAP) → TypeSafe AI → Switch on category.

`examples/email-classifier-outlook.workflow.json` – the same flow on the Microsoft Outlook trigger
(subject + body preview only), with a fallback branch for unknown categories.

Neither file carries credential ids or data — pick the credential after importing. The categories
(billing / support / sales / spam) are placeholders until the real list is confirmed.

## Develop
```sh
npm install
npm run build
npm test                             # unit tests for questions.ts
npm run lint
TYPESAFE_API_KEY=... npm run smoke   # direct API call with the node's wire shapes
npm run n8n:dev                      # build, link into .n8n-dev/ and start n8n on :5678
```

## Releasing
Pushing to `main` never publishes: `.github/workflows/release.yml` only runs on a `v*.*.*` tag.

Run this on `main` with a clean working tree — `npm version` refuses to run on a dirty tree, and the
tag ships whatever commit it points at:

```sh
git status --porcelain      # must be empty
npm version 0.2.0           # bumps package.json, commits, tags v0.2.0
git push origin main
git push origin v0.2.0      # this is what starts the release
```

The run then waits for approval on the `npm` environment. Once approved it checks the tag matches
`package.json` version (and fails before publishing if it does not), runs `npm ci --ignore-scripts`,
lint, build and tests on Node 24, and finally `npm publish --access public --provenance`.
`prepublishOnly` rebuilds `dist/` so the tarball is always a fresh build of the tagged commit.
Provenance also requires the GitHub repo to stay public.

Prerequisites, both one-time and both Farhan's to do in the GitHub repo settings:
- **Secrets → Actions → `NPM_TOKEN`** – an npm automation token for the `@biztactix` scope.
- **Environments → `npm`** with a required reviewer – the publish job targets this environment, so
  every release waits for Farhan to approve it before anything reaches the registry.

Nothing is published until that approval, and a tag can be deleted and re-pushed if the guard fails.

## License
MIT
