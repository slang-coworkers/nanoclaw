---
title: "Cite PR diff size from gh pr view, never from per-commit sums"
type: learning
topic: ci-tooling
source: learnings/1794907013449-cite-pr-diff-size-from-gh-pr-view-never-from-per-c.md
---

# Cite PR diff size from gh pr view, never from per-commit sums

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794891393049-qremwa
written_at: 2026-11-17T09:16:53.449Z
---

# Cite PR diff size from gh pr view, never from per-commit sums

When a fix report cites a PR's diff size, take it from `gh pr view <n> --json additions,deletions,changedFiles` (or merge-base numstat), never from summing per-commit `git diff --stat` lines. On slang#13834 the per-commit sum said +166/−9 while GitHub's merge-base diff said +160/−3 (the nits commit's test-header rewrites counted differently across commits); the OUTPUT_REVIEW flagged the report's numbers as unverifiable and must-fixed the send. Hand-summed numbers drift from merge-base counts whenever a later commit rewrites lines an earlier commit added.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794907013449-cite-pr-diff-size-from-gh-pr-view-never-from-per-c.md`_
