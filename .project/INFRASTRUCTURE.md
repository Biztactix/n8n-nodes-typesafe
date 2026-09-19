# n8n-nodes-typesafe — Infrastructure

This project ships a library, not a service. "Infrastructure" is: the npm registry, the GitHub repo, and the n8n instance that loads the package.

## Environments

| Environment | URL | Purpose | Notes |
|------------|-----|---------|-------|
| Development | local (`/mnt/repos/n8n-nodes-typesafe`) | Build, lint, smoke test; local n8n via `npx n8n` with the package linked into `~/.n8n/custom` | Node 24 on the dev box. Local n8n try-out not done yet |
| Staging | none | — | No staging n8n. Test with a disabled/duplicate workflow on production n8n, or locally |
| Production | https://automation.biztactix.com.au | Biztactix n8n, runs the mail workflow | n8n runs in **Coolify** (Docker). Node installed via Settings → Community Nodes from npm |
| Upstream API | https://api.typesafe.ai | TypeSafe AI | Third party; single production endpoint |

## CI/CD

Status: **no CI yet**. Source is on GitHub at `github.com/Biztactix/n8n-nodes-typesafe` (remote `origin`, branch `main`); GitHub Actions workflows still to be added.

### Build Pipeline

Planned (GitHub Actions), on push and PR: `npm ci` → `npm run lint` → `npm run build` → unit tests (once they exist). The live smoke test stays manual or gated on a repository secret.

### Deployment Process

1. Bump `version` in `package.json`, tag `vX.Y.Z`.
2. Planned: Actions publishes `@biztactix/n8n-nodes-typesafe` to npm on tag (public, `--access public` for the scope). Until CI exists: `npm publish` by hand (`prepublishOnly` runs the build). **Ask before publishing or pushing.**
3. On n8n: Settings → Community Nodes → Install (first time) or Update. Requires `N8N_COMMUNITY_PACKAGES_ENABLED` not set to `false` on the Coolify service.
4. Add a "TypeSafe AI API" credential in n8n; the built-in test hits `/v1/models`.

Fallback without publishing: `npm pack`, copy the `.tgz` into the n8n container, `npm install` it under `~/.n8n/nodes`, restart; or mount the built package and set `N8N_CUSTOM_EXTENSIONS`. On Coolify the `~/.n8n` volume must be persistent or the install is lost on redeploy (TBD: confirm the volume mapping).

### Rollback Procedure

Install the previous version in Community Nodes (or `npm install @biztactix/n8n-nodes-typesafe@<prev>` in `~/.n8n/nodes`) and restart n8n. npm versions are immutable; deprecate a bad version rather than unpublishing. Workflows are unaffected unless the node `version` or output shape changed.

## Hosting & Services

| Service | Use |
|---------|-----|
| npm registry | Distribution of the public package (scope `@biztactix`; TBD: confirm the npm org exists and who owns the publish token) |
| GitHub | Source, Actions CI (planned) |
| Coolify | Hosts the production n8n container. Server/VPS details: TBD (ask: Farhan) |
| TypeSafe AI | Upstream API, billed by token usage (`usage.input_tokens` / `output_tokens` returned per call) |

## Monitoring & Alerting

Nothing specific to this package. Failures surface as n8n execution errors; use an n8n Error Workflow on the mail workflow for alerting (TBD: whether one exists). `x-typesafe-request-id` is available for upstream support but is not currently surfaced in the node output.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TYPESAFE_API_KEY` | smoke test only | API key for `scripts/smoke.mjs`. Never committed or printed |
| `TYPESAFE_BASE_URL` | no | Override the API base URL for the smoke script |
| `TYPESAFE_DEFAULT_MODEL` | no | Override the model for the smoke script (default `jev-latest`) |
| `N8N_COMMUNITY_PACKAGES_ENABLED` | n8n host | Must not be `false` for Community Nodes install |
| `N8N_CUSTOM_EXTENSIONS` | n8n host, fallback only | Path to a mounted build when not installing from npm |
| `NPM_TOKEN` | CI (planned) | GitHub Actions secret for publish on tag |

The node itself reads no environment variables; its key and base URL come from the n8n credential.

## Backup & Recovery

Source is recoverable from git (once pushed) and published versions from npm. The package holds no data. n8n workflows and encrypted credentials are part of the n8n instance's backup, outside this repo (TBD: confirm Coolify volume/database backups for n8n).

---
*Last reviewed: 2026-09-19*
*Update this document when infrastructure changes. The daily audit checks for staleness.*
