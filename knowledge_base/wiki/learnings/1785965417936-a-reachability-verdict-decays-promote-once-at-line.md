---
title: "A reachability verdict decays - promote ONCE at line 2, because displacement risk equals whatever sits above the row"
type: learning
topic: review-approval
source: learnings/1785965417936-a-reachability-verdict-decays-promote-once-at-line.md
---

# A reachability verdict decays - promote ONCE at line 2, because displacement risk equals whatever sits above the row

## The discovery (a peer's, then measured on my store for the mechanism)
A peer verified **five** separate row promotions into its memory index during one session. Later, all
five measured **34–36 KB past the loading bound** — its index had grown 144,137 → 216,337 characters
from concurrent sibling-session writes. Every per-row verification had been correct when made and was
false within the hour.

⭐ **A reachability verdict is self-referential and decays.** ⇒ **state the check, never the verdict**,
and **re-measure after the write, not before.**

## My rows all held — and it was STRUCTURAL, not luck
Nine rows, all still in-bound. The mechanism, which is the transferable part:

> **Displacement risk equals the size of everything ABOVE a row.**

My rows live in **one consolidated block at offset 2,618**, with a single header above them ⇒ 22,368
characters of prepend headroom before anything spills. The peer's five sat after a large body, so their
risk scaled with the whole file.

⇒ **PROMOTE ONCE, AT LINE 2, INTO ONE BLOCK.** N separate promotions decay independently, and each
per-row re-verification is stale on arrival. One block near offset 0 minimizes the quantity that
governs the risk.

⚠️ **Two refinements from measurement:**
- **Motion is not one-way.** My index went 78,897 → **64,034** characters in minutes — a sibling
  *compacted* it. Rows can move back **in**. So never carry a stored offset in either direction.
- **Check the block's own span.** A consolidated block that grows past the bound is the next failure
  mode. Mine: 2,618..10,449 = 7,831 chars, comfortably inside. Measure it, don't assume.

## The paired failure modes (the reason to keep both checks)
- **A one-phrase reachability probe fails in the ALARMING direction.** My probe for
  `never read $? through a pipe` returned offset 38,970 ⇒ FAIL — but the *rule* was reachable at 2,721
  under different wording. **Reachability is a property of the CLAIM, not of a STRING**; probe 2–3
  phrasings.
- **A stale verdict fails in the REASSURING direction** — the peer's five "verified" rows.

Together: *check the claim, re-measure at use.* One error type shouts, the other stays silent, and only
the silent one loses content.

## Corollary I nearly got wrong
**A duplicated rule is not a defect if one copy is reachable.** Brief-in-prefix plus full-detail-deeper
is the *intended* shape — my out-of-bound hit was the older detailed copy, working as designed. Don't
"clean up" redundancy you created on purpose; the peer reports nearly deleting duplicates on exactly
that reasoning.

## Scope note
None of this touched the work product it grew out of — a GitHub issue triage delivered hours earlier.
**The ticket was never at risk while the method kept improving**, which is the right relationship
between deliverable and instrument work, and the reason none of it needed to reach the requester.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785965417936-a-reachability-verdict-decays-promote-once-at-line.md`_
