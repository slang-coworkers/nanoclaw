---
title: "[approver/human-disagreement] An ABSTAIN the human OVERRULES is the false-abstain signal — 'abstain rows are excluded from scoring' hides the entire over-conservative direction; plus: if your cited precedent has a named author, check whether they're a pending reviewer"
type: learning
topic: review-approval
source: learnings/1786113486048-approver-human-disagreement-an-abstain-the-human-o.md
---

# [approver/human-disagreement] An ABSTAIN the human OVERRULES is the false-abstain signal — "abstain rows are excluded from scoring" hides the entire over-conservative direction; plus: if your cited precedent has a named author, check whether they're a pending reviewer

# slang-rhi#813: my ABSTAIN_POLICY(OPEN_GAP) was merged unchanged, with a formal APPROVED at my exact head

**Outcome, verified against live GitHub (a merge webhook is a claim about state, not state):**

- `state=MERGED`, `mergedAt=2026-08-07T14:30:33Z`, `mergedBy=skallweitNV`
- **`skallweitNV` submitted a formal `APPROVED` review at `commit.oid = abec21d2fdb4` — my exact
  decided head — 7 seconds before merging.** `reviewDecision` went `REVIEW_REQUIRED` → `APPROVED`.
- **One commit on the PR, ever.** Merged content byte-identical to what I decided: +2/−2 in
  `src/d3d12/d3d12-device.cpp` and `src/vulkan/vk-buffer.cpp`. No test added, no comment requesting
  one, no change demanded.

My decision was `ABSTAIN_POLICY` / `OPEN_GAP`: *"a human must look at the state contract."*

## ⛔ Rule 1: join every abstain — "abstain rows are excluded from scoring" hides the false-abstain direction

My own memory row for this PR asserted *"ABSTAIN rows are excluded from approval scoring ⇒ no join
needed."* **That is wrong, and I've retracted it.** An abstain that the human *overrules* is precisely
the false-abstain signal. Excluding those rows means the feedback loop only ever punishes
false-APPROVES — so conservative-lean appears to cost nothing, and the over-conservative miss rate is
structurally invisible.

Scoring: decision `ABSTAIN_POLICY`, human `APPROVED`, **same commit** ⇒
`[approver/human-disagreement]`, over-conservative direction. Explicitly **not**
`[approver/false-safe]` (that class is WOULD_APPROVE vs CHANGES_REQUESTED — the unsafe direction). No
defect shipped here; the cost was a withheld approval on a correct two-line fix.

## ⛔ Rule 2: the falsifiability test for any abstain post-mortem

The tempting story was: *"I said a human must look; a human looked; the mechanism worked."* **That
framing is unfalsifiable and therefore worthless as calibration — it scores every abstain as correct
no matter what the human decides.**

**State what outcome would have proven the abstain WRONG. If no outcome could, the abstain wasn't a
judgment — it was a refusal to make one.** Here the disproof was available and was met: merged
unchanged, at my head, by the domain owner. Contrast two abstains of mine that had a disproof
available and *survived* it: one where the held-on tests later executed and failed, and one where the
author independently landed a commit fixing the exact recorded gap.

## ⭐ Rule 3 (the genuinely new one): if your cited precedent has a named author, check whether they're a pending reviewer

My clearing argument cited commit `9a0f422` — `fixupTextureDesc` on these same two backends —
**authored by `skallweitNV`**. Another reviewer then explicitly deferred to `skallweitNV` ("he is more
familiar with this code"), and `skallweitNV` approved and merged.

So I had, inside my own derivation, identified the one human whose judgment settled the question —
and still charged a gap against him.

**When the design question is "is this the library's intended contract?", the precedent-author's
review is not corroboration — it is the answer.** Grep the precedent's author out of `git log`, check
them against the pending reviewer list, and if they're on it, consider that waiting for their review
is strictly better information than charging a gap they are about to adjudicate.

## ⭐ Rule 4: a critique can be right about the reasoning flaw and still overshoot on severity

A DECISION_REVIEW critique flipped my initial `WOULD_APPROVE` to `ABSTAIN`. Its *reasoning* was
correct and still stands: I had proven the helper pure/monotone/deterministic and treated that as
correctness, but that is a claim about the **function**, not about the externally-owned resource's
actual state. Genuine error, well caught.

But the **severity** it drove — `OPEN_GAP` rather than nit — is what the outcome contradicts.
**"The critique reversed me" is not evidence that the reversal's magnitude was right.** The lesson is
emphatically *not* "resist critique reversals" — mine have caught five real round-ups. It is that
severity is a separate judgment from validity, and its cost only becomes visible at join time, which
is exactly why the join must be recorded.

## Meta: this join only happened because the merge event was treated as a trigger, not a notification

Related discipline from the same chain: three supervisor nudges arrived on this PR, each on a
different predicate (`awaiting_us`, then "human spoke last", then "newest non-bot comment is null"),
each premise false in a different way — and the third produced the *right* verdict from a *wrong*
premise, making it self-certifying. **Fixing one predicate does not fix its siblings**, and
**confirming your own position is when you owe the hardest check.**

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786113486048-approver-human-disagreement-an-abstain-the-human-o.md`_
