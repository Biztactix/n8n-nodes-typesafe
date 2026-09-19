# n8n-nodes-typesafe — Decisions

Newest first. Status: Accepted / Proposed / Superseded.

## D-009: CI and hosting on GitHub with GitHub Actions
- **Date:** 2026-09-19
- **Status:** Accepted (not yet implemented)
- **Context:** No commits, remote or CI exist. `package.json` already points at `github.com/Biztactix-Ryan/n8n-nodes-typesafe`.
- **Decision:** Host on GitHub; Actions runs build + lint + tests on push/PR and publishes to npm on tag.
- **Consequences:** Needs an `NPM_TOKEN` secret and an `@biztactix` npm org. Pushing and publishing still require asking first.

## D-008: Production install is from npm via Community Nodes on the Coolify-hosted n8n
- **Date:** 2026-09-19
- **Status:** Accepted
- **Context:** n8n at `automation.biztactix.com.au` runs in Coolify. Options were publish to npm, copy a `.tgz` into the container, or mount the build with `N8N_CUSTOM_EXTENSIONS`.
- **Decision:** Publish first, install by package name in Settings → Community Nodes. Tarball/mount stay as fallbacks for pre-release testing.
- **Consequences:** The package must be public and secret-free. The `~/.n8n` volume on Coolify must persist so the install survives redeploys.

## D-007: Publish as scoped `@biztactix/n8n-nodes-typesafe`
- **Date:** 2026-09-19
- **Status:** Accepted
- **Context:** n8n's verified community-node list expects unscoped `n8n-nodes-*` names; self-hosted installs accept scoped names.
- **Decision:** Keep the `@biztactix` scope.
- **Consequences:** Clear ownership, no name squatting concerns. If n8n verification is wanted later, the package may need an unscoped name; lint rules are followed now so that stays cheap.

## D-006: First mail workflow uses the Microsoft 365 / Outlook trigger
- **Date:** 2026-09-19
- **Status:** Accepted
- **Context:** The example workflow uses an IMAP trigger as a generic placeholder.
- **Decision:** The real Biztactix workflow triggers on Microsoft 365 / Outlook. The node stays trigger-agnostic.
- **Consequences:** The example should gain (or be swapped to) an Outlook variant; field mapping for State uses the Outlook item's subject and body preview/text.

## D-005: No runtime dependencies
- **Date:** 2026-09-19
- **Status:** Accepted
- **Context:** Community nodes run inside the host n8n process; extra deps add supply-chain risk and block verification.
- **Decision:** `n8n-workflow` types only (peer dependency); HTTP through n8n's helper; `fetch` in the smoke script.
- **Consequences:** Tiny package, `dist/` only. Anything needing a library must be justified against this.

## D-004: Retries are n8n's job
- **Date:** 2026-09-19
- **Status:** Accepted
- **Context:** The SDKs retry 408/409/429/5xx with backoff.
- **Decision:** Do not re-implement retries; users enable the node's built-in "Retry On Fail". The node only offers a per-request timeout (default 60 s).
- **Consequences:** `Retry-After` is not honoured yet (roadmap: later).

## D-003: Flatten answers to `results.<name>`, keep full answers under `typesafe`
- **Date:** 2026-09-19
- **Status:** Accepted
- **Context:** Switch/IF nodes need one plain value per question; power users need confidence and probabilities.
- **Decision:** `results`: choice → label, score → number, noul → probability. Full response under `typesafe.{model,usage,answers}`. Input fields copied through by default.
- **Consequences:** The output shape is a public contract; changing it needs a node `version` bump.

## D-002: Wire parity with the official SDKs; `model` defaults to `jev-latest`
- **Date:** 2026-09-19
- **Status:** Accepted
- **Context:** The API rejects requests without `model` (422). Python/JS SDKs v0.6.0 and the C# port default to `jev-latest`.
- **Decision:** Same endpoints, body shapes and default as the SDKs; `../TypesafeAI-C#` is the reference. A raw questions JSON option covers anything the form does not.
- **Consequences:** API changes are tracked through the SDKs; `npm run smoke` verifies the shapes against the live API.

## D-001: Build a community node rather than use the HTTP Request node
- **Date:** 2026-09-19
- **Status:** Accepted
- **Context:** HTTP Request + Set works today and was the ten-minute route.
- **Decision:** Build a node: proper testable credential type, form-built questions that non-developers can edit, routing-friendly output, one reusable node instead of copied JSON.
- **Consequences:** A package to maintain, publish and keep lint-clean under `eslint-plugin-n8n-nodes-base`.

---
*Last reviewed: 2026-09-19*
