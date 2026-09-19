---
archived: false
assignee: claude
claimed_at: null
claimed_by_run: null
created: '2026-09-19'
depends_on: []
id: US-TSN-1-4
points: 2
status: done
story_id: US-TSN-1
tags: []
title: Local n8n harness with the built package linked
updated: '2026-09-19'
---

Make it one command to try the node in a real n8n. Build the package, link or copy it into ~/.n8n/custom (or set N8N_CUSTOM_EXTENSIONS to the repo) and start n8n with npx n8n on the dev box (Node 24). Add an npm script or scripts/ helper plus a short 'Try it in n8n' section in docs/DESIGN.md. Confirm n8n lists the TypeSafe AI node and TypeSafe AI API credential and the icon renders. Do not commit any n8n user data or keys; the API key is read from the environment per CLAUDE.md, never copied into the repo.