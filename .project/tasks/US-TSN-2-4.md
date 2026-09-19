---
archived: false
assignee: null
claimed_at: null
claimed_by_run: null
created: '2026-09-19'
depends_on:
- US-TSN-2-3
id: US-TSN-2-4
points: 2
status: todo
story_id: US-TSN-2
tags: []
title: buildQuestions unit tests
updated: '2026-09-19'
---

Cover: noul with no criteria, only whenTrue, both; choice labels split by newline and by comma, 'label = description' parsing, empty description becomes null, whitespace trimming, fewer than two labels throws; score rubric split by line only (commas preserved inside a level), fewer than two levels throws; missing or blank name throws; raw JSON overlay adds questions and wins on a name clash; raw entry without a string type throws; empty collection returns {}.