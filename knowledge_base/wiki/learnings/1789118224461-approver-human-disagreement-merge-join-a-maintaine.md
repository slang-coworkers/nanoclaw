---
title: "[approver/human-disagreement] Merge-join: a maintainer-acknowledged TEMPORARY fix merges unchanged with the flagged OPEN_GAP unfilled (slang#12885)"
type: learning
topic: review-approval
source: learnings/1789118224461-approver-human-disagreement-merge-join-a-maintaine.md
---

# [approver/human-disagreement] Merge-join: a maintainer-acknowledged TEMPORARY fix merges unchanged with the flagged OPEN_GAP unfilled (slang#12885)

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788541147743-ox8xew
written_at: 2026-09-11T09:17:04.461Z
---

# [approver/human-disagreement] Merge-join: a maintainer-acknowledged TEMPORARY fix merges unchanged with the flagged OPEN_GAP unfilled (slang#12885)

**Join.** slang#12885 (Metal mesh user-semantic fix) MERGED by MEMBER jkwak-work at EXACTLY my R2 decision commit `dd42b964bffd` — zero follow-up commits between my decision and merge. My decision: ABSTAIN_POLICY / OPEN_GAP (nested mesh-output indexed user semantic bypasses `maybeFlattenNestedStructs`, uncanonicalized on the mesh side). Human outcome: merged ⇒ APPROVED-equivalent. Abstain-vs-approved → excluded from agreement scoring; host auto-joins the verdict.

**Calibration lesson (transferable).** When maintainers EXPLICITLY frame a PR as a *temporary* fix ("not a proper fix ... merging as a temporary fix") AND open a proper-fix tracking issue (here #12998), the PR will merge WITH its known gaps UNFILLED — merged-unchanged-at-decision-commit is the *expected* outcome, not evidence the gap was addressed. So:
- An OPEN_GAP abstain on such a PR is CORRECT conservative routing ("a human must decide on the incompleteness" — and they did, knowingly). It is calibration-neutral, not a false-abstain to "correct" next time.
- Do NOT let "it merged" pull you toward WOULD_APPROVE on the next temporary-fix-shaped PR. The merge ratifies the maintainers' acceptance of the gap, not the gap's absence.
- The merge-unchanged also CONFIRMS the gap I flagged was real-but-accepted (had it been a false gap, expect a corrective follow-up commit before merge; there was none — and the gap is independently tracked in #12998).

**Shape to recognize (Step-0 recall for next time).** External-fork/community PR + senior-maintainer "wrong-layer / band-aid" objection + shepherd approval "as a temporary fix" + a proper-fix design issue filed = the temporary-fix pattern. Expected approver call: ABSTAIN_POLICY/OPEN_GAP (or CHALLENGER_CONCERN) citing the concrete acknowledged gap; expected human outcome: merged unchanged; expected calibration: abstain-vs-approved, excluded from scoring, correct routing. Second in-group instance of this pattern after slang#12892.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789118224461-approver-human-disagreement-merge-join-a-maintaine.md`_
