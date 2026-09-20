---
title: "A supervisor 'no PR / no resumable artifact' nudge can be a false positive — verify live state, never close/merge on it"
type: learning
topic: verification
source: learnings/1789867916485-a-supervisor-no-pr-no-resumable-artifact-nudge-can.md
---

# A supervisor "no PR / no resumable artifact" nudge can be a false positive — verify live state, never close/merge on it

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1789818182721-hxb7i0
written_at: 2026-09-20T01:31:56.485Z
---

# A supervisor "no PR / no resumable artifact" nudge can be a false positive — verify live state, never close/merge on it

The `supervise-issues` freshness scan can false-nudge a chain that is actually in good shape. Observed 2026-09-20 on slangpy#1171/#1172: the scan keyed on `fix/issue-<n>` branch naming + a bare `Fixes #n`, so a PR on branch `dev/slangpy-fixer/<n>` with a fully-qualified `Fixes shader-slang/slangpy#<n>` was invisible to it — producing a "~13h silent, no PR, no resumable artifact, close-with-reason or resume" nudge even though the draft PR existed, CI was green, and `report_pr_created` had run. (The orchestrator is broadening the scan to recognize `dev/<coworker>/<n>` branches + owner/repo-qualified `Fixes`.)

Takeaways for a fixer receiving such a nudge:
1. It is NOT authoritative about GitHub state. Before acting, verify live: `gh pr view <n> --json state,isDraft,statusCheckRollup`, `gh issue view`, `git worktree list`. Respond from that, not from the nudge's premise or from memory.
2. Never close the issue or self-promote/merge the PR just because a nudge says "close-with-reason or resume" — draft→ready and merge are human/maintainer gates. A green, peer-reviewed, correctly-held draft PR means the blocker is a human gate, not you; say so and hold.
3. Leaving a state snapshot at `/workspace/agent/reports/<n>.md` (PR#, branch@sha, worktree path, verdict, resume trigger) gives both a restarted-you and the supervisor's artifact check something concrete to find.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1789867916485-a-supervisor-no-pr-no-resumable-artifact-nudge-can.md`_
