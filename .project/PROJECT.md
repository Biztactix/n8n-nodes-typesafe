# n8n-nodes-typesafe

n8n community node for the TypeSafe AI API, so n8n workflows can classify, score and ask yes/no questions about text or JSON. First use: classify inbound email on Biztactix's n8n (`automation.biztactix.com.au`) as the first step of the mail workflow. Started by Farhan at Biztactix, 2026-09-19. Sibling of the C# SDK at `../TypesafeAI-C#`, which is the reference for the wire format.

## Architecture

A single TypeScript package loaded in-process by n8n: one credential type, one node with two operations (`systemOne`, `listModels`), and a pure question-builder module. It calls the TypeSafe AI REST API over HTTPS with a Bearer key. See ARCHITECTURE.md for the service map and contracts.

### Tech Stack

- **Language**: TypeScript ^5.6, compiled with `tsc` to `dist/`. Node ≥ 20.15 (Node 24 on the dev box)
- **Framework**: n8n community-node API (`n8nNodesApiVersion: 1`), `n8n-workflow` ^1.82 types
- **Database**: none
- **Key Libraries**: none at runtime. Dev only: `eslint` ^8.57 + `eslint-plugin-n8n-nodes-base` ^1.16.3, `@typescript-eslint/parser` ^8, `rimraf` ^6

### Components

| Component | Path | Responsibility |
|-----------|------|----------------|
| Credential | `credentials/TypeSafeApi.credentials.ts` | API key + base URL, Bearer auth, credential test against `/v1/models` |
| Node | `nodes/TypeSafe/TypeSafe.node.ts` | Operations, question builder UI, model dropdown, execute loop, output shaping, error mapping |
| Question logic | `nodes/TypeSafe/questions.ts` | `buildQuestions`, `flattenAnswers`; pure, unit-test target |
| Icon | `nodes/TypeSafe/typesafe.svg` | Copied into `dist/` by `scripts/copy-icons.mjs` |
| Smoke test | `scripts/smoke.mjs` | Direct live API call with the node's wire shapes |
| Example | `examples/email-classifier.workflow.json` | Email trigger → TypeSafe AI → Switch on category |
| Design brief | `docs/DESIGN.md` | Rationale, wire format, install options, open questions, roadmap |

### Data Flow

Input item → node reads State (text or JSON), Model, Questions form + optional raw questions JSON → `buildQuestions` → `POST {baseUrl}/v1/systemone` via `httpRequestWithAuthentication` → response → `flattenAnswers` → output item `{ ...input, typesafe: { model, usage, answers }, results: { name: value } }` → downstream Switch/IF. One API call per input item.

## Key Decisions

See DECISIONS.md. Headlines: custom node rather than HTTP Request; wire parity with the official SDKs; `results` flattening; retries left to n8n; no runtime dependencies; publish to npm as `@biztactix/n8n-nodes-typesafe`.

## Dependencies

| Dependency | Kind | Purpose |
|------------|------|---------|
| TypeSafe AI API (`api.typesafe.ai`) | SaaS | The classifier; models `jev-latest`, `jev-preview` (default resolved to `jev-1.13.0` on 2026-09-19) |
| `n8n-workflow` | peer (`*`), dev ^1.82.0 | Types and error classes; provided by the host n8n at runtime |
| `eslint-plugin-n8n-nodes-base` | dev | n8n community-node rules, keeps verification possible |
| `typescript`, `rimraf`, `@typescript-eslint/parser`, `eslint` | dev | Build and lint |

## Development Setup

Prerequisites: Node ≥ 20.15, npm.

| Task | Command |
|------|---------|
| Install | `npm install` |
| Build | `npm run build` (rimraf + tsc + copy icons) |
| Watch | `npm run dev` |
| Lint | `npm run lint` / `npm run lintfix` |
| Smoke test (live API) | `TYPESAFE_API_KEY=... npm run smoke` |
| Try in n8n | `npm run build && npm pack`, install the `.tgz`, or link into `~/.n8n/custom` (docs/DESIGN.md) |

Env vars (names only): `TYPESAFE_API_KEY` (required for smoke), `TYPESAFE_BASE_URL`, `TYPESAFE_DEFAULT_MODEL` (optional). On the dev box the Biztactix key lives in `../TypesafeAI-C#/tests/TypeSafe.Sdk.IntegrationTests/Local/local.runsettings` (gitignored); read it into the environment, never copy it.

Tests: none yet. Commit style: conventional commits with a body. Do not publish to npm or push without asking.

---
*Last reviewed: 2026-09-19*
*Update this document when architecture changes. The daily audit checks for staleness.*
