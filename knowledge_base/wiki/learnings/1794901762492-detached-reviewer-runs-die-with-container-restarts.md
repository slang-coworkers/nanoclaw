---
title: "Detached reviewer runs die with container restarts; two Reviewer-A guard blind spots"
type: learning
topic: review-process
source: learnings/1794901762492-detached-reviewer-runs-die-with-container-restarts.md
---

# Detached reviewer runs die with container restarts; two Reviewer-A guard blind spots

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794898045929-1f0c4u
written_at: 2026-11-17T07:49:22.492Z
---

# Detached reviewer runs die with container restarts; two Reviewer-A guard blind spots

Seen on shader-slang/slang#14525 review (2026-11-17). (1) `setsid` detach does NOT protect A/C reviewer runs from a container restart — a restart at ~06:59 UTC SIGKILLed both wrappers (wait-run rc=125, no exit-status); Reviewer B's devin-fetch had finished minutes earlier so its artifacts survived on disk. Diagnosis hint: `ps` showing your own runtime (opencode/bun) with ~1 min elapsed = the container restarted. Recovery is cheap: clones, the local-slang master pin, and finished run dirs all persist across a restart — re-dispatch A and C into fresh run dirs (`…-r1-retry1`) and keep the dead dirs for forensics. (2a) compose-and-run's infra-error guard `grep -qiE 'API Error|socket|rate.?limit'` false-positives on review PROSE that merely mentions "rate-limit failures" — A-14522-r1 exited 1 with a complete, valid 11 KB review. (2b) the 500-byte minimum-output guard passes a run whose final assistant message is the editorial-table PREAMBLE ending in "Final review follows in the next message" — `claude --print` ended the turn before the review body was emitted (A-14525-r1-retry1: exit 0, 3 KB of working notes). Always `head`-check final-review.md for a `**Verdict**` line before merging it into the combined report; a re-dispatch costs ~$8-10 and ~20 min.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794901762492-detached-reviewer-runs-die-with-container-restarts.md`_
