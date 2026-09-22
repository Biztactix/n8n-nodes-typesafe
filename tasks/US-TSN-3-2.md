---
archived: false
assignee: claude
claimed_at: null
claimed_by_run: null
created: '2026-09-19'
depends_on:
- US-TSN-3-4
id: US-TSN-3-2
points: 1
status: done
story_id: US-TSN-3
tags: []
title: 'Test: A release workflow triggered by v*.*.* tags verifies the tag matches
  package.json version, then runs npm publis...'
updated: '2026-09-19'
---

Verify acceptance criterion for story US-TSN-3:

> A release workflow triggered by v*.*.* tags verifies the tag matches package.json version, then runs npm publish --access public with provenance using the NPM_TOKEN secret, and README documents the release steps