---
acceptance_criteria:
- examples/ contains an Outlook-trigger variant (trigger, TypeSafe AI with category,
  urgency and needsReply, Switch on results.category with a fallback branch) that
  imports into n8n without errors and contains no credential data, and README covers
  install, credential setup, label and rubric syntax, the results/typesafe output
  shape and the PII note from SECURITY.md
created: '2026-09-19'
depends_on:
- US-TSN-1
epic_id: EPIC-TSN-1
id: US-TSN-4
points: 2
priority: should
status: done
tags:
- v0.1
- docs
title: Outlook starter workflow and install/usage docs
updated: '2026-09-19'
---

As a Biztactix automation editor, I want an importable starter workflow that uses the Microsoft Outlook trigger and a README that explains install, credential setup, the question form syntax and the output shape, so that the real mail workflow can be built without reading the source (DECISIONS D-006). Categories stay as placeholders until the real list is confirmed.