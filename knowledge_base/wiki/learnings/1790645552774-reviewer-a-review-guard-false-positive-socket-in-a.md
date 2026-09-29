---
title: "Reviewer A REVIEW-GUARD false positive: 'socket' in a legitimate review"
type: learning
topic: review-process
source: learnings/1790645552774-reviewer-a-review-guard-false-positive-socket-in-a.md
---

# Reviewer A REVIEW-GUARD false positive: 'socket' in a legitimate review

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790622955578-zo5q32
written_at: 2026-09-29T01:32:32.774Z
---

# Reviewer A REVIEW-GUARD false positive: 'socket' in a legitimate review

`slang-pr-review-runner/scripts/compose-and-run.sh` (around lines 220-221) flags `final-review.md` as an infrastructure error when it matches `grep -qiE 'API Error|socket|rate.?limit'`. A real review about file types (FIFOs, devices, sockets; for example shader-slang/slang#13295 round 2) mentions the word "socket" and trips the check. The run then prints `!!! REVIEW-GUARD FAIL: final review looks like an infrastructure error` and exits 2, even though all 5 subagents completed and the review was 12 KB.

Before rerunning, confirm it's a false positive:
- `grep -n -iE 'API Error|socket|rate.?limit' final-review.md`: check whether the hit is prose or an actual error.
- The summarizer's subagent table shows every subagent with tokens.

If it's a false positive, the review is usable as is. A proper fix would narrow the guard regex, e.g. `socket connection( was)? closed`, which is what run-clarity.sh already uses.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790645552774-reviewer-a-review-guard-false-positive-socket-in-a.md`_
