# n8n-nodes-typesafe — Security

The package has no users, sessions or storage of its own. Its security surface is: one API key, the content sent to a third-party API, and the npm supply chain.

## Authentication

### Method

API key to TypeSafe AI, sent as `Authorization: Bearer <key>` on every request (same as the official SDKs). The key is an n8n credential of type `typeSafeApi` (`apiKey` is a password field), injected by n8n's generic auth; the node calls `httpRequestWithAuthentication` and never reads the key itself.

### Token/Session Management

Static API key, no expiry known, no refresh. Rotation: issue a new key in TypeSafe, update the n8n credential, revoke the old one. The credential test (`GET /v1/models`) confirms a key works.

### Multi-factor Authentication

Not applicable to the node. Access to the n8n UI (where credentials and workflows are edited) is governed by the n8n instance.

## Authorization

### Roles & Permissions

| Role | Permissions | Description |
|------|------------|-------------|
| n8n credential owner / sharee | Use the TypeSafe key in workflows | Controlled by n8n credential sharing |
| npm publisher | Publish `@biztactix/n8n-nodes-typesafe` | TBD (ask: Farhan, who holds the `@biztactix` npm org/token) |
| GitHub maintainer | Push, tag, manage Actions secrets | Biztactix |

### Enforcement

All enforced by the host systems (n8n, npm, GitHub). The node adds no authorization layer.

## Data Protection

### Encryption

In transit: HTTPS to `api.typesafe.ai` (the base URL is user-editable; keep it `https://`). At rest: the key is encrypted by n8n with the instance encryption key. The package stores nothing.

### PII Handling

The first use sends inbound email subject and body, which contain customer PII, to TypeSafe AI, a third party. Send only what the questions need (subject + text body, not attachments or full headers). TypeSafe's retention and training policy: TBD (ask: check TypeSafe terms before production mail goes through). With "Include Input Fields" on, the full input item is carried into the output and therefore into n8n's execution history.

### Data Retention

None in the package. n8n execution data retention is an instance setting (`EXECUTIONS_DATA_PRUNE` / max age) on the Coolify service: TBD.

## API Security

- Outbound only; the node exposes no endpoints.
- Input validation in `questions.ts`: question names required, choice ≥ 2 labels, score ≥ 2 rubric levels, raw questions must be objects with a string `type`. Bad JSON state fails the item.
- Rate limiting is upstream (429 with `Retry-After`); the node does not retry, n8n "Retry On Fail" does.
- Per-request timeout (default 60 s) so a hung call fails the item, not the workflow.
- Email content is attacker-controlled text fed to a model. Treat `results` as advisory routing input: do not let a classification alone trigger destructive or external actions (auto-delete, auto-reply with data).

## Secrets Management

| Secret | Lives in | Never in |
|--------|----------|----------|
| TypeSafe API key (production) | n8n credential store, encrypted | repo, workflow JSON, logs |
| TypeSafe API key (dev) | `TYPESAFE_API_KEY` env; source on the dev box is the gitignored `../TypesafeAI-C#/tests/TypeSafe.Sdk.IntegrationTests/Local/local.runsettings` | this repo; do not copy it, read it into the environment |
| `NPMPUSH` (added 2026-09-21) | GitHub Actions secret | repo |

`.gitignore` excludes `.env`, `.env.*`, `local/`, `*.tgz`. The published tarball contains `dist/` only (`files` in `package.json`). The smoke script never prints the key. Exported workflow JSON in `examples/` must reference credentials by name only.

## Known Risks & Mitigations

| Risk | Severity | Mitigation | Status |
|------|----------|------------|--------|
| Customer email content (PII) sent to a third-party API | Medium | Minimise the state; confirm TypeSafe data-handling terms | Open |
| Prompt injection via email text skews classification | Medium | Results drive routing only; keep a human or safe default branch for high-impact actions; use confidence/probabilities for a fallback branch | Open |
| API key leaked via repo, logs or exported workflow | High | Key only in n8n credentials / env; gitignore; examples carry no credential data | Mitigated |
| Supply chain: compromised npm publish token or dependency | Medium | Zero runtime deps; scoped package; publish from CI on tag with a granular token and 2FA on the npm org | Planned |
| `baseUrl` override pointed at a hostile host leaks the key | Low | Only credential editors can change it; documented as proxy/non-prod only | Accepted |
| No tests or CI, regressions reach production n8n | Medium | Unit tests for `questions.ts`, Actions pipeline | Planned |
| Full input copied into output/execution history | Low | "Include Input Fields" can be turned off; set n8n execution pruning | Open |

## Incident Response

Key exposure: revoke/rotate the key in TypeSafe, update the n8n credential, check TypeSafe usage for abuse. Bad release: `npm deprecate` the version, publish a fix, pin the previous version in n8n. Contact: Farhan (Biztactix). Escalation and upstream security contact at TypeSafe: TBD.

---
*Last reviewed: 2026-09-19*
*Update this document when security posture changes. The daily audit checks for staleness.*
