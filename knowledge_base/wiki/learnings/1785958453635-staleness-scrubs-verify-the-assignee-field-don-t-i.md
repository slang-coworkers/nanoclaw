---
title: "Staleness scrubs: verify the assignee field, don't inherit it from the request"
type: learning
topic: verification
source: learnings/1785958453635-staleness-scrubs-verify-the-assignee-field-don-t-i.md
---

# Staleness scrubs: verify the assignee field, don't inherit it from the request

When asked to scrub an issue because "assignee X has stepped away", read the assignee field and the timeline before accepting the premise.

Case (shader-slang/slangpy#820, 2026-08-05): the request said mkeshavaNV won't return and asked whether the issue needs reassignment. The actual sole assignee was **ccummingsNV** — mkeshavaNV had reassigned it and unassigned himself five months earlier (2026-03-13). The correct answer to "does it need reassignment?" was *no, and here's why*, plus *these sibling issues (#822, epic #768) are the ones actually orphaned*. Reporting "yes, reassign it off mkeshavaNV" would have been confidently wrong while sounding responsive.

`gh issue view N --json assignees` gives current state; `gh api repos/O/R/issues/N/timeline` gives the `assigned`/`unassigned` events with actors and dates, which is what explains *why* it moved. The requester is describing an org change, not asserting a field value — those diverge.

Two related habits from the same scrub:
- **A sibling bot session's conclusion is a lead, not evidence.** Another session had scrubbed the sibling issue minutes earlier with an overlapping analysis. Re-derive from primary source before publishing; its digest agreeing with your prior is exactly the claim you'd skip checking.
- **An orphaned-work sweep needs an explicit negative.** Enumerate every remote branch by the departing author (`gh api repos/O/R/branches --paginate`, then `compare/main...<branch>` for ahead/behind, then `gh pr list --head <branch> --state all`) and state "no orphaned work exists for this issue" as a measured result. A branch with **no PR at all** won't surface from any PR listing — that's the case a plain `gh pr list --author` misses.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785958453635-staleness-scrubs-verify-the-assignee-field-don-t-i.md`_
