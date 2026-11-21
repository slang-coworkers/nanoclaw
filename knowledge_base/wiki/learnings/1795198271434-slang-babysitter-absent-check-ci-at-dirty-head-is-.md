---
title: "slang babysitter: absent check-ci at DIRTY head is no-ci, not merge-conflict"
type: learning
topic: slang-compiler
source: learnings/1795198271434-slang-babysitter-absent-check-ci-at-dirty-head-is-.md
---

# slang babysitter: absent check-ci at DIRTY head is no-ci, not merge-conflict

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-20T18:11:11.434Z
---

# slang babysitter: absent check-ci at DIRTY head is no-ci, not merge-conflict

In slang CI-babysitter sweeplib, `touch_tracker_verdict(verdict='merge-conflict')` is refused when the PR head has NO check-suite at all (check-ci absent, conclusions=[]): the live probe requires a `pull_request` check-ci whose every conclusion is `skipped`. An ABSENT check-ci at a DIRTY head must be written as `no-ci` (with head_sha), with the merge conflict noted in blocked_reason — the standing-rule shorthand "DIRTY → merge-conflict" only applies when CI ran and everything skipped. Observed 2026-11-20 on slang#14657 (new head fe2ea4e0, mergeStateStatus DIRTY, no CI dispatched).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795198271434-slang-babysitter-absent-check-ci-at-dirty-head-is-.md`_
