# n8n-nodes-typesafe — Vision

## Problem

Biztactix wants n8n workflows to make typed decisions about text and JSON (which team, how urgent, does it need a reply) using the TypeSafe AI API. Today that means an HTTP Request node with pasted JSON plus a Set node to dig answers out: the key handling is ad hoc, the questions are only editable by developers, and every workflow carries its own copy of the request.

## Who it is for

| Audience | What they get |
|----------|---------------|
| Biztactix automation (first consumer) | Inbound email on `automate.biztactix.com.au` classified as the first step of the mail workflow (Microsoft 365 / Outlook trigger), then routed with a Switch node |
| Non-developer workflow editors | Questions built in a form (name, type, labels / rubric) instead of raw JSON |
| Other self-hosted n8n users | A public npm community node for TypeSafe AI that holds no secrets |

## What success looks like (6-12 months)

- The Biztactix mail workflow runs in production on the node: every inbound email gets a category, an urgency score and a needs-reply probability, and is routed without a human triage step.
- `@biztactix/n8n-nodes-typesafe` is published on npm, installed through Settings → Community Nodes, with CI (build + lint + tests) and tag-driven releases.
- `questions.ts` is unit-tested and the package is lint-clean under `eslint-plugin-n8n-nodes-base`, so n8n verification stays possible later.
- A second Biztactix workflow (not email) uses the node, proving it is general rather than mail-specific.

## Principles

1. **Wire parity with the official SDKs.** Same endpoints, bodies and defaults as the TypeSafe Python/JS SDKs (v0.6.0) and the C# port at `../TypesafeAI-C#`. When in doubt, the C# SDK is the reference.
2. **Use n8n, don't re-implement it.** Credentials, retries ("Retry On Fail"), "Continue On Fail", paired items and expressions are n8n's job. The node adds the question builder and output shaping only.
3. **Routing-friendly output.** `results.<name>` is one plain value per question so Switch/IF nodes work without a Set node; the full typed answers stay under `typesafe.answers`.
4. **No secrets, no runtime dependencies.** The package is public; the key lives only in n8n credentials. `n8n-workflow` types only, nothing shipped at runtime beyond `dist/`.

## Roadmap

| Status | Item |
|--------|------|
| Done (2026-09-19) | Scaffold: credential, node, question builder, smoke script, starter workflow. Build and lint clean; smoke test passed against the live API |
| Next | Load in a local n8n (`npx n8n`, package linked into `~/.n8n/custom`) and fix UI issues |
| Next | Unit tests for `questions.ts` (vitest or `node:test`) |
| Next | GitHub repo + GitHub Actions: build, lint, tests; release to npm on tag |
| Next | Publish `@biztactix/n8n-nodes-typesafe`, install on the Coolify-hosted n8n, wire the real Microsoft 365 mail workflow with the real categories |
| Later | Batch mode if the API adds it, typed enum helpers, `Retry-After` awareness |

## Open questions

- The real email categories and any extra per-email questions (sentiment, etc.): TBD (ask: Farhan). The example workflow uses placeholders billing / support / sales / spam.

---
*Last reviewed: 2026-09-19*
