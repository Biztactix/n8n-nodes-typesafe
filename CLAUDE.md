# n8n-nodes-typesafe
n8n community node for the TypeSafe AI API, so n8n workflows can classify, score and ask yes/no questions about text or JSON. First use: classify inbound email on Biztactix's n8n at automation.biztactix.com.au as the first step of the mail workflow. Started by Farhan at Biztactix, 2026-09-19. Sibling of the C# SDK at `../TypesafeAI-C#`, which is the reference for the wire format.

## Stack
TypeScript on Node 20+ (Node 24 on the dev box) · `n8n-workflow` types only, no runtime deps · `tsc` build to `dist/` · npm package `@biztactix/n8n-nodes-typesafe` · unit tests on the built-in `node:test` runner, compiled separately into `dist-test/` (`.project/DECISIONS.md` D-010).

## Commands
| Task | Command |
|------|---------|
| Install | `npm install` |
| Build | `npm run build` (tsc + copy icons into dist) |
| Lint (n8n rules) | `npm run lint` |
| Unit tests | `npm test` (node:test over `test/*.test.ts`, compiled to `dist-test/`) |
| Wire-format smoke test | `TYPESAFE_API_KEY=... npm run smoke` (hits the live API, no n8n needed) |
| Local n8n try-out | `npm run n8n:dev` — builds, links `dist/` into `.n8n-dev/` (isolated n8n user folder, gitignored) and runs `npx n8n@2.39.8` on :5678; Ctrl-C to stop, delete `.n8n-dev/` to reset (docs/DESIGN.md) |

## Layout
- `credentials/TypeSafeApi.credentials.ts` — API key + base URL, Bearer auth, credential test against `/v1/models`.
- `nodes/TypeSafe/TypeSafe.node.ts` — the node: operations `systemOne` and `listModels`, question builder UI, output shaping.
- `nodes/TypeSafe/questions.ts` — pure functions: UI collection to API `questions` object, and answer flattening. Unit-test target.
- `test/questions.build.test.ts`, `test/questions.flatten.test.ts` — unit tests (`node:test`); `tsconfig.test.json` builds them to the gitignored `dist-test/`, never into `dist/`.
- `examples/email-classifier.workflow.json` — importable starter workflow: email trigger, TypeSafe node, Switch on category.
- `docs/DESIGN.md` — why a node rather than HTTP Request, wire format, output shape, install options, open questions, roadmap.
- `scripts/smoke.mjs` — direct API call using the same JSON shapes as the node.

## Config & secrets
The API key lives only in n8n credentials (encrypted) or `TYPESAFE_API_KEY` for the smoke script. Never in the repo, never printed. On the dev box the Biztactix key is in `../TypesafeAI-C#/tests/TypeSafe.Sdk.IntegrationTests/Local/local.runsettings` (gitignored); read it into the environment, do not copy it.

## Deploy
Target: npm (public package, contains no secrets) then Settings → Community Nodes on the n8n instance. Not yet published. CI: `.github/workflows/ci.yml` runs lint, build and unit tests on push to `main` and on pull requests, on Node 20.x and 24.x (current LTS) — no secrets and no live API calls. Release: `.github/workflows/release.yml` fires only on a `v*.*.*` tag, checks the tag against `package.json` version, then lint/build/test on Node 24 and `npm publish --access public --provenance` (`NODE_AUTH_TOKEN` from the `NPM_TOKEN` secret, `id-token: write`); the job targets the `npm` GitHub environment so Farhan approves every publish. Release steps are in the README ("Releasing"); `NPM_TOKEN` and the `npm` environment with a required reviewer still have to be created in repo settings. Both workflow files exist in the working tree but are not committed or pushed yet, so neither has ever run on GitHub and the README carries no badge yet. automation.biztactix.com.au runs in Coolify, so the path is publish first, then install by name (`.project/DECISIONS.md` D-007 to D-009). Do not publish to npm or push without asking.

## Conventions
- Wire parity with the official TypeSafe SDKs (Python/JS v0.6.0) and the C# port: `POST /v1/systemone`, `GET /v1/models`, `Authorization: Bearer`.
- Follow n8n community-node conventions (`eslint-plugin-n8n-nodes-base`) so the package can be verified later.
- Commit style: conventional (`feat:`, `fix:`, ...) with a body.
