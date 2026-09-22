---
created: '2026-09-19'
id: EPIC-TSN-1
points: null
priority: must
status: active
tags:
- v0.1
target_date: null
title: Ship v0.1 to production n8n
updated: '2026-09-19'
---

Take the scaffolded TypeSafe AI community node from "builds and lints" to running the Biztactix mail workflow on automate.biztactix.com.au.

Success criteria:
- Node verified inside a real n8n (credential test, model dropdown, noul/choice/score questions, error paths).
- questions.ts unit-tested; GitHub Actions runs build + lint + tests and publishes to npm on tag.
- @biztactix/n8n-nodes-typesafe v0.1.0 published and installed via Community Nodes on the Coolify-hosted n8n.
- Microsoft 365 inbound mail classified (category, urgency, needsReply) and routed with a Switch node using the real categories.

Out of scope: batch mode, typed enum helpers, Retry-After awareness (later roadmap).