---
acceptance_criteria:
- npm test runs the unit tests and exits non-zero on failure, and tests cover buildQuestions
  for noul (with and without criteria), choice (newline, comma and label = description
  syntax), score rubric, raw JSON overlay precedence, and every validation error
- flattenAnswers tests cover noul, choice, score and unknown answer types, and test
  files are excluded from the published tarball (npm pack --dry-run shows dist node
  and credential files only)
created: '2026-09-19'
depends_on: []
epic_id: EPIC-TSN-1
id: US-TSN-2
points: 3
priority: must
status: backlog
tags:
- v0.1
- tests
title: Unit tests for questions.ts
updated: '2026-09-19'
---

As a maintainer, I want buildQuestions and flattenAnswers covered by unit tests so that changes to the form syntax or wire shapes cannot silently break users' workflows. questions.ts is pure by design (no n8n runtime needed). Keep to the no-runtime-deps decision (D-005); prefer node:test against compiled output or a single small dev dependency.