---
acceptance_criteria:
- A local n8n started with the built package linked into ~/.n8n/custom shows the TypeSafe
  AI node and the TypeSafe AI API credential, and the credential test passes with
  a valid key and fails with a bad one
- Ask Questions returns results.<name> and typesafe.answers for noul, choice and score
  questions with text and JSON state, the model dropdown lists models, and List Models
  returns one item per model
- Validation and API errors surface as per-item node errors and Continue On Fail yields
  an error item; every issue found is fixed or recorded in docs/DESIGN.md
created: '2026-09-19'
depends_on: []
epic_id: EPIC-TSN-1
id: US-TSN-1
points: 5
priority: must
status: backlog
tags:
- v0.1
- n8n
title: Node loads and works in a local n8n
updated: '2026-09-19'
---

As a workflow builder, I want the TypeSafe AI node to load and behave correctly inside a real n8n so that it can be trusted before it is published. So far it has only been built, linted and smoke-tested against the API directly; it has never been loaded by n8n (docs/DESIGN.md roadmap).