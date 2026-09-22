---
acceptance_criteria: []
created: '2026-09-19'
depends_on:
- US-TSN-1
- US-TSN-2
- US-TSN-3
epic_id: EPIC-TSN-1
id: US-TSN-5
points: 5
priority: must
status: backlog
tags:
- v0.1
- release
- needs-human
title: Publish v0.1.0 and install on the production n8n
updated: '2026-09-19'
---

As Biztactix, I want @biztactix/n8n-nodes-typesafe v0.1.0 on npm and installed through Settings, Community Nodes on the Coolify-hosted n8n at automate.biztactix.com.au so that production workflows can use the node (DECISIONS D-007, D-008). Needs Farhan: the @biztactix npm org and publish token, Coolify access, confirmation that the ~/.n8n volume persists across redeploys, and an explicit go-ahead to publish.