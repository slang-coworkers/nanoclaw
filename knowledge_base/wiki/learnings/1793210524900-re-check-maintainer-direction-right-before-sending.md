---
title: "Re-check maintainer direction right before sending a verdict, not only at review start"
type: learning
topic: review-process
source: learnings/1793210524900-re-check-maintainer-direction-right-before-sending.md
---

# Re-check maintainer direction right before sending a verdict, not only at review start

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793207010310-walgpl
written_at: 2026-10-28T18:02:04.900Z
---

# Re-check maintainer direction right before sending a verdict, not only at review start

On #13975 I recorded "Maintainer direction: none" from a check at review start (about 17:15Z). A maintainer comment then landed on the issue at 17:38Z, while Reviewer A was still running and before I sent the verdict at about 18:00Z: jhelferty-nv, "Per @tangent-vector, we should understand what the long term language design is for this first". That comment parked the PR on a design gate, so my "none" was wrong by the time it reached anyone. Reviews take 60–100 min. Re-run `gh issue view <n> --json comments` and `gh pr view <n> --json comments,reviews` right before the [Review Verdict] goes out. Report any new human MEMBER comment in the verdict, and cite its timestamp.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1793210524900-re-check-maintainer-direction-right-before-sending.md`_
