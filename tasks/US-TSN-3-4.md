---
archived: false
assignee: claude
claimed_at: null
claimed_by_run: null
created: '2026-09-19'
depends_on:
- US-TSN-3-3
id: US-TSN-3-4
points: 2
status: done
story_id: US-TSN-3
tags: []
title: 'Release workflow: publish to npm on version tag'
updated: '2026-09-19'
---

Add .github/workflows/release.yml: trigger on tags v*.*.*; verify the tag equals package.json version; npm ci, lint, build, test; npm publish --access public --provenance with NODE_AUTH_TOKEN from the NPM_TOKEN secret and id-token: write permission. Document the release steps in README (bump version, tag, push tag) and note that Farhan must add NPM_TOKEN and approve each publish. Do NOT push a tag or publish in this task.