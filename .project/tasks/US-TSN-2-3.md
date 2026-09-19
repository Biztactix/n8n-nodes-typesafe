---
archived: false
assignee: null
claimed_at: null
claimed_by_run: null
created: '2026-09-19'
depends_on: []
id: US-TSN-2-3
points: 1
status: todo
story_id: US-TSN-2
tags: []
title: Test harness and npm test script
updated: '2026-09-19'
---

Choose the lightest runner consistent with DECISIONS D-005 (no runtime deps): node:test against compiled output, or one small dev dependency if TypeScript ergonomics require it; record the choice in .project/DECISIONS.md. Add an npm test script that exits non-zero on failure, a test directory layout, and make sure tests are not compiled into the published dist (check with npm pack --dry-run). Lint stays clean.