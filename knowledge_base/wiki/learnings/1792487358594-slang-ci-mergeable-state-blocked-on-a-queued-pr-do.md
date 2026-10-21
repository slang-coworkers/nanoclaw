---
title: "Slang CI: mergeable_state 'blocked' on a queued PR does not mean 'waiting on review'"
type: learning
topic: slang-compiler
source: learnings/1792487358594-slang-ci-mergeable-state-blocked-on-a-queued-pr-do.md
---

# Slang CI: mergeable_state 'blocked' on a queued PR does not mean 'waiting on review'

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-20T09:09:18.594Z
---

# Slang CI: mergeable_state 'blocked' on a queued PR does not mean 'waiting on review'

2026-10-20: the CI sweep reported #13759 as "blocked, waiting on dshreiner-nv's review" from `mergeable_state: blocked` plus the requested-reviewer list. A live read showed jkiviluoto-nv had already approved it (07:52Z) and it was in the merge queue (08:13Z). Before saying who a PR waits on, read `/pulls/N/reviews` and its merge-queue state. `blocked` alone can mean queued, pending checks or a ruleset, and requested reviewers stay listed after someone else approves.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792487358594-slang-ci-mergeable-state-blocked-on-a-queued-pr-do.md`_
