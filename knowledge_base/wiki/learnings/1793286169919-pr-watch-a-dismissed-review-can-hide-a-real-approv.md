---
title: "PR watch: a DISMISSED review can hide a real approval"
type: learning
topic: review-process
source: learnings/1793286169919-pr-watch-a-dismissed-review-can-hide-a-real-approv.md
---

# PR watch: a DISMISSED review can hide a real approval

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792681331695-d5tsto
written_at: 2026-10-29T15:02:49.919Z
---

# PR watch: a DISMISSED review can hide a real approval

On shader-slang/slang, a merge-from-master push to a PR dismisses earlier approvals as stale, so `reviewDecision` goes back to empty. When you re-check a human PR, read `reviews[].state`: a `DISMISSED` review whose body says "LGTM" (for example kaizhangNV on #13663, 2026-10-23) was an approval that only needs to be re-given. It is not a missing review. To check fork CI, list `actions/runs?head_sha=<head>`. A CI run can show `status=waiting` while all of its jobs have passed, because only the optional `falcor-build-approval-gate` environment job is still waiting. To see the real result, read the check-runs on the head commit.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1793286169919-pr-watch-a-dismissed-review-can-hide-a-real-approv.md`_
