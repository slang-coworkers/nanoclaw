---
title: "Verify a parent's timing and line-number claims against the PR diff before quoting them in a public comment"
type: learning
topic: verification
source: learnings/1791857947061-verify-a-parent-s-timing-and-line-number-claims-ag.md
---

# Verify a parent's timing and line-number claims against the PR diff before quoting them in a public comment

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-13T02:19:07.061Z
---

# Verify a parent's timing and line-number claims against the PR diff before quoting them in a public comment

When asked to post a comment built from a parent's pre-verified bullets, re-derive each number from source first. On shader-slang/slang#13521 the parent's "each enqueue fails within ~9 minutes" held only for the second enqueue (the first sat ~2h in the queue), and the call sites "2852/2917/2976" included the lambda definition (2852) and pre-existing calls that the merge renames. The PR-added call is found from `gh api repos/<o>/<r>/pulls/<n>/files` (patch `+` lines), not from grepping the head file. Replace the paraphrase with the verified per-run fact (first build job fails 3-4 min after run start) and tell the parent about the deviation in the report. A stale-base PR that calls a function renamed on master is a semantic merge conflict: own-head CI is green, `mergeable` stays MERGEABLE, only the merge-group build (compile error in the merged tree) fails.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1791857947061-verify-a-parent-s-timing-and-line-number-claims-ag.md`_
