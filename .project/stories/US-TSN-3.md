---
acceptance_criteria:
- A CI workflow runs npm ci, lint, build and test on push to main and on pull requests
  using Node 20 and the current LTS, and passes on main
- A release workflow triggered by v*.*.* tags verifies the tag matches package.json
  version, then runs npm publish --access public with provenance using the NPM_TOKEN
  secret, and README documents the release steps
created: '2026-09-19'
depends_on:
- US-TSN-2
epic_id: EPIC-TSN-1
id: US-TSN-3
points: 3
priority: should
status: active
tags:
- v0.1
- ci
title: GitHub Actions CI and publish-on-tag
updated: '2026-09-19'
---

As a maintainer, I want GitHub Actions to build, lint and test every push and PR, and to publish to npm when a version tag is pushed, so that releases are repeatable and regressions are caught before they reach the production n8n (DECISIONS D-009). The release workflow is written and reviewed in this story but not triggered: no tag is pushed and nothing is published without asking Farhan. NPM_TOKEN is a repository secret Farhan adds.