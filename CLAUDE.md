# n8n-nodes-typesafe
n8n community node for the TypeSafe AI API, so n8n workflows can classify, score and ask yes/no questions about text or JSON. First use: classify inbound email on Biztactix's n8n at automate.biztactix.com.au as the first step of the mail workflow. Started by Farhan at Biztactix, 2026-09-19. Sibling of the C# SDK at `../TypesafeAI-C#`, which is the reference for the wire format.

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
Target: npm (public package, contains no secrets) then Settings → Community Nodes on the n8n instance. Not yet published. CI: `.github/workflows/ci.yml` runs lint, build and unit tests on push to `main` and on pull requests, on Node 20.x and 24.x (current LTS) — no secrets and no live API calls. Release: `.github/workflows/release.yml` fires only on a `v*.*.*` tag, checks the tag against `package.json` version, then lint/build/test on Node 24 and `npm pack` once (job `build`); job `github-release` attaches that tarball, a version-less `n8n-nodes-typesafe.tgz` copy and `SHA256SUMS.txt` to a GitHub Release for hand installs (no secret, no approval), and job `publish` runs `npm stage publish <that tarball> --access public --provenance` (`NODE_AUTH_TOKEN` from the `NPMPUSH` secret, `id-token: write`) — it stages, never publishes directly (Farhan's call, 2026-09-22): the version goes live only when Farhan approves it with 2FA (`npm stage list` / `npm stage approve <stage-id>`, npm >= 11.16). Release steps are in the README ("Releasing"); the `NPMPUSH` repo secret exists (added 2026-09-21); the `npm` GitHub environment the job targets is an optional second gate and does not exist yet. `npm stage` requires the package to already exist on npm, which it does not, so the job publishes directly only when `npm view` returns E404 (first release; `NPMPUSH` got publish rights on 2026-09-22 for that) and stages every time after. Both workflows were pushed on 2026-09-20; the first CI run passed, `release.yml` has never run (no `v*.*.*` tag yet) and the README carries no badge yet. A GitHub pre-release `pre-0.1.0` (tag deliberately outside `v*.*.*`) carries the 0.1.0 tarball for manual installs before npm. automate.biztactix.com.au runs in Coolify, so the path is publish first, then install by name (`.project/DECISIONS.md` D-007 to D-009). Do not publish to npm or push without asking.

## Conventions
- Wire parity with the official TypeSafe SDKs (Python/JS v0.6.0) and the C# port: `POST /v1/systemone`, `GET /v1/models`, `Authorization: Bearer`.
- Follow n8n community-node conventions (`eslint-plugin-n8n-nodes-base`) so the package can be verified later.
- Commit style: conventional (`feat:`, `fix:`, ...) with a body.
