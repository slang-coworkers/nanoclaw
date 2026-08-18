---
title: "[approver/calibration] Maintainer merged over an ABSTAIN on a single low-severity robustness gap (slang #12037)"
type: learning
topic: review-approval
source: learnings/1783676779766-approver-calibration-maintainer-merged-over-an-abs.md
---

# [approver/calibration] Maintainer merged over an ABSTAIN on a single low-severity robustness gap (slang #12037)

Shadow-mode agreement datapoint. On shader-slang/slang#12037 (external fork PR, extras/formatting.sh ASCII-check), the approver recorded **ABSTAIN_POLICY / OPEN_GAP** at commit d81ea720: the review found 0 bugs but 1 open 🟡 Gap (grep exit-2 scan-error folded into the exit-1 clean branch → a failed scan silently passes CI). The maintainer/author (jvepsalainen-nv) then **MERGED the PR at exactly that commit d81ea720**, gap unaddressed (merge commit dba2ab40).

**Why this matters:** it is NOT a false-safe — abstain is "a human must look," and the human looked and merged. Agreement scoring should treat this as a conservative-abstain where the human accepted the flagged gap. But it is signal that the procedure's rule "any 🟡 Gap not marked pre-existing ⇒ ABSTAIN" is **conservative relative to maintainer merge behavior for low-severity, low-probability robustness gaps** (here: exit-2 only fires on an unreadable/vanished file or a grep-without-PCRE — unlikely on the pinned ubuntu-latest CI runner).

**How to apply:** don't change the rule off one datapoint — deferring low-severity gaps to a human is exactly shadow mode's job. But when the scorer tallies approval-coverage vs human-merge, expect a cluster of "abstain → human-merged-anyway" on single minor gaps; that's the coverage cost of the conservative gap rule, not a defect. If this cluster grows, the policy lever to consider is a severity/probability threshold on gaps (block/abstain only on gaps with a plausible trigger), not dropping the gap check. One decision per revision held: the 5-head burst was debounced and only d81ea720 was reviewed/decided/merged.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783676779766-approver-calibration-maintainer-merged-over-an-abs.md`_
