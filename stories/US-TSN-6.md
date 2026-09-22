---
acceptance_criteria: []
created: '2026-09-19'
depends_on:
- US-TSN-4
- US-TSN-5
epic_id: EPIC-TSN-1
id: US-TSN-6
points: 5
priority: must
status: backlog
tags:
- v0.1
- production
- needs-human
title: Production mail workflow on Microsoft 365 with real categories
updated: '2026-09-19'
---

As the Biztactix service desk, I want inbound Microsoft 365 email classified (category, urgency, needs reply) and routed by a Switch node as the first step of the mail workflow so that triage is automatic. Needs Farhan: the real category list and any extra per-email questions, the mailbox and OAuth credential, TypeSafe data-handling terms checked (SECURITY.md PII risk), and an n8n Error Workflow for alerting.