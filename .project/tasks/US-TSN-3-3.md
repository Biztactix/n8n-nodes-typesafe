---
archived: false
assignee: null
claimed_at: null
claimed_by_run: null
created: '2026-09-19'
depends_on: []
id: US-TSN-3-3
points: 2
status: todo
story_id: US-TSN-3
tags: []
title: 'CI workflow: lint, build, test on push and PR'
updated: '2026-09-19'
---

Add .github/workflows/ci.yml: triggers on push to main and pull_request; matrix Node 20 and current LTS; npm ci, npm run lint, npm run build, npm test; npm cache. No secrets and no live API calls in CI (the smoke script stays manual). Pushing the workflow to GitHub needs Farhan's go-ahead per CLAUDE.md; once pushed, confirm the run is green and add a status badge to README.