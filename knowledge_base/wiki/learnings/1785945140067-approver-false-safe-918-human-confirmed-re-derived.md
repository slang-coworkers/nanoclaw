---
title: "[approver/false-safe] #918 human-confirmed: re-derived WOULD_APPROVE agrees with ccummingsNV APPROVED + MERGED at the SAME head I decided — the staging fallback destroyed a correct-agreement datum, and conservative-direction bugs cost calibration signal rather than triggering alarms"
type: learning
topic: review-approval
source: learnings/1785945140067-approver-false-safe-918-human-confirmed-re-derived.md
---

# [approver/false-safe] #918 human-confirmed: re-derived WOULD_APPROVE agrees with ccummingsNV APPROVED + MERGED at the SAME head I decided — the staging fallback destroyed a correct-agreement datum, and conservative-direction bugs cost calibration signal rather than triggering alarms

# [approver/false-safe] The one case where the fallback changed the verdict — and the human agreed with the bot

## Symptom

slangpy#918 was recorded **ABSTAIN_POLICY** (`head_provenance`: fork head
`jhelferty-nv/slangpy`, "policy forbids"). Re-derived against the policy actually in
force at its run date (2026-07-22 ⇒ `v0-shadow-relaxed`, which already had
`allow_fork_head: true`), Step 2 reads `APPROVE`, 0 bugs, 0 gaps ⇒ **WOULD_APPROVE**.

Ground truth, measured:

```
state=MERGED  mergedAt=2026-07-22T20:25:12Z  mergedBy=jhelferty-nv
headOwner=jhelferty-nv  crossRepository=true  reviewDecision=APPROVED
author=jhelferty-nv     head=57259b457b4c
```

**The head I decided (`57259b457b4c`) is the exact head that merged.** So the
re-derived WOULD_APPROVE agrees with the human outcome on the same revision — no
drift, no "a later commit fixed it." That is the strongest form this datum can take,
and the recorded abstain destroyed it.

Sequencing caveat kept deliberately: the `APPROVED` review is dated 2026-04-07,
months before the 07-22 run, so the corroboration rests on **the merge**, not on the
approval postdating the decision. (Guarding this because dating a fact from the wrong
event is the error that recurred three times in this chain.)

## Root cause — and why nothing alerted

The staging fallback pinned the skill-bundled `v0-shadow`, which is **uniformly
stricter on all six axes** (associations 3 vs 7, fork false vs true, `require_ci_green`
true vs false, paths 8 vs 1, caps 400/30 vs 8000/150). So it reverts every relaxation
at once and the clause that fires is incidental — here `head_provenance`, on a fork
PR whose fork-ness was legitimate and already permitted.

The consequence worth internalizing: **the defect's direction is uniformly
conservative.** Nothing became wrongly permissive, so nothing merged that shouldn't
have, no human was misled toward risk, and **no alarm of any kind fired.** The entire
cost is measurement: an abstain looks like caution, so a run where the procedure was
*right* got recorded as a run where it had nothing to say. In a shadow programme whose
only product is agreement scoring against human verdicts, that is the expensive
failure — a false-negative is invisible precisely because it's safe.

This inverts the usual severity intuition. Across this chain every other defect was a
check *passing* for the wrong reason (the thing that gets caught eventually, because
something eventually breaks). This one *failed* for the wrong reason, and could have
run indefinitely.

## How to catch it

Join every decision against the PR's real outcome, and require head alignment:

```bash
gh pr view $PR --repo $R --json state,mergedAt,mergedBy,headRefOid,reviewDecision,isCrossRepository
# decision was on the merged head?  -> strongest agreement datum
# recorded ABSTAIN but PR merged with APPROVED and clean Step 2 -> FALSE-NEGATIVE
```

Falsifiers: (1) recorded abstain + merged + `reviewDecision: APPROVED` + Step-2
`APPROVE`/0 gaps ⇒ false-negative, highest severity for calibration; (2) decided head
≠ merged head ⇒ weaker claim, say so; (3) the human approval predating the run ⇒ rest
corroboration on the merge, not the approval.

## Fix

- Re-record #918 as WOULD_APPROVE for calibration; it is the only verdict-level change
  among the four fallback-pinned runs (the others: #925 abstain-on-merits with a
  spurious reason code, `1078-b76c` correctly ABSTAIN_INFRA since
  `reviewers_complete: false` — a review-input failure *independent of policy*, not a
  third policy casualty, `1078-06e7` ABSTAIN_POLICY:OPEN_GAP).
- **Report re-derivations as derivation + outcome + which policy version the
  re-derivation loaded** — the whole point being that the recorded run loaded the wrong
  one. A re-derived outcome without its policy version is unauditable.
- **Standing addition: periodically join recorded ABSTAINs against merged-and-approved
  outcomes.** Conservative failures don't announce themselves; the only way to find
  them is to go looking for abstains that history contradicted.

**Method note:** this became a verdict-level finding only because I enumerated the
failing clause *per run* instead of generalizing from the one in front of me. Naming a
mechanism after the clause you happened to observe would have scoped the fix to path
patterns and left the `author_trust`/`head_provenance` reversions alive and silent.
**Enumerate before naming.**

Siblings: the 21→4 correction; "clause-eligible is not approvable"; the sayability
entry (the crisp framing — "the `.github/**` widening" — outlived the true one for six
rounds).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785945140067-approver-false-safe-918-human-confirmed-re-derived.md`_
