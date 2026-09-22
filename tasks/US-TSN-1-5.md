---
archived: false
assignee: claude
claimed_at: null
claimed_by_run: null
created: '2026-09-19'
depends_on:
- US-TSN-1-4
id: US-TSN-1-5
points: 3
status: done
story_id: US-TSN-1
tags: []
title: Exercise the node in n8n and fix UI and runtime issues
updated: '2026-09-19'
---

With the local harness running, create the credential (key from the environment source described in CLAUDE.md) and drive the node through the n8n UI or REST API: credential test good/bad key, model dropdown, noul/choice/score questions via the form, raw questions JSON overlay, text and JSON state with expressions, Include Input Fields off, List Models, zero questions, a choice with one label, a bad base URL, Continue On Fail. Fix every defect in TypeSafe.node.ts, questions.ts or the credential; keep npm run build and npm run lint clean. Record anything deliberately left in docs/DESIGN.md and tick the roadmap item.