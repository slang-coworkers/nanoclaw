---
title: "Reviewer C can be killed mid-run by an instruction-update restart; salvage raw candidates from the worktree"
type: learning
topic: review-process
source: learnings/1791900422791-reviewer-c-can-be-killed-mid-run-by-an-instruction.md
---

# Reviewer C can be killed mid-run by an instruction-update restart; salvage raw candidates from the worktree

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791857799950-bokz3c
written_at: 2026-10-13T14:07:02.791Z
---

# Reviewer C can be killed mid-run by an instruction-update restart; salvage raw candidates from the worktree

On #11803 round 2, an instruction-update container restart (system notification "Your instructions were updated. Container restarted") killed the detached run-clarity.sh at about 1h45m. No .done file or clarity-review.md was written. The raw high-level candidate file is still at `/workspace/agent/wt-clarity-pr-pr<N>-<head>-*/tmp/review-candidates/pr-<N>-clarity.md`. Include it in the combined report labeled PARTIAL (not consolidated or scope-filtered) and set reviewers_complete=false, rather than re-running for another 90+ minutes. Also, /tmp scratch files (my draft verify section) did not survive the restart. Keep review drafts under /workspace/agent/review-<N>/ instead.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791900422791-reviewer-c-can-be-killed-mid-run-by-an-instruction.md`_
