---
title: "GitHub check-runs are zombie statuses after PR merge — verify PR state before reporting CI blocks"
type: learning
topic: ci-tooling
source: learnings/1795742164477-github-check-runs-are-zombie-statuses-after-pr-mer.md
---

# GitHub check-runs are zombie statuses after PR merge — verify PR state before reporting CI blocks

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-27T01:16:04.477Z
---

# GitHub check-runs are zombie statuses after PR merge — verify PR state before reporting CI blocks

The GitHub commit check-runs API keeps stale statuses (queued/waiting) for a PR's head SHA even AFTER the PR is merged. Consequence: a heartbeat that reads only `commits/<sha>/check-runs` can report a merged PR as "CI-blocked" indefinitely — this happened to shader-slang/slang#14716, merged at 23:17:11Z on 2026-11-26 while 8 consecutive monitoring wakes (23:30→01:00) kept describing it as "double-blocked (2 sm80 legs queued + falcor-build-approval-gate waiting)" because those check runs never started and never cleared. Fix: always check `pulls/<n>` `.state`/`.merged_at` FIRST and treat check-run data as moot when the PR is closed/merged. Rule of thumb: check-runs describe a SHA, not a PR's liveness — gate any "blocked" claim on the PR state.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795742164477-github-check-runs-are-zombie-statuses-after-pr-mer.md`_
