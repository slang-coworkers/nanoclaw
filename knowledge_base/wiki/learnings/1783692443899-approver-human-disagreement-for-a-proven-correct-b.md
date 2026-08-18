---
title: "approver/human-disagreement: for a proven-correct behavior-preserving perf fix from a trusted contributor, maintainers approve-with-nits over 'missing test + invariant-doc-scope' gaps — the shadow abstain is conservative-by-design, not a signal something's wrong"
type: learning
topic: review-approval
source: learnings/1783692443899-approver-human-disagreement-for-a-proven-correct-b.md
---

# approver/human-disagreement: for a proven-correct behavior-preserving perf fix from a trusted contributor, maintainers approve-with-nits over "missing test + invariant-doc-scope" gaps — the shadow abstain is conservative-by-design, not a signal something's wrong

**Calibration case (slang#12041, IR type-legalization quadratic fix for #12040).** My R0 decision: `ABSTAIN_POLICY / OPEN_GAP` (2 non-pre-existing 🟡 gaps floored it; incomplete panel also did). Human outcome: **APPROVED** — maintainer skiminki-nv formally approved 18 min later, author merged at **exactly the commit I decided on** (`7a58052c0a9f`), **zero follow-up commits**, both my flagged gaps left unaddressed. Scorer axis: withhold-on-SAFE (the conservative direction — NOT a false-safe; I never approved-on-unsafe).

**The class signal (sharpens the NEXT R0 read of similar code):** When a small (+42/−2, one file), behavior-preserving **performance** fix from a trusted contributor has its ONLY findings be (a) "ships with no regression test" and (b) an invariant whose *comment/assert scope is broader than enforced* — **and the challenger has independently proven the change has no current failure mode** (here: 0 `setOperand` in the file; all in-place `simple`-returning mutators change full type, so the `changed` predicate catches every real change in release too) — the human maintainer bar is **"merge it, nits are follow-up,"** not "block/hold." Gaps of this *shape* (test-coverage + invariant-documentation on a change already shown correct) are routinely approved-with-nits.

**What this does and does NOT change:**
- Does NOT change the procedure. slang-pr-approver Step 2 is deterministic: any non-pre-existing 🟡 gap → ABSTAIN_POLICY:OPEN_GAP. The abstain was procedurally correct and I must keep making it. Shadow mode measures agreement; it never rounds up to approve.
- DOES calibrate the *framing*. When reporting such an abstain, state plainly that the shadow abstain is **conservative-by-design** ("human must look at nits"), not evidence the PR is risky — especially when my own challenger proved the code correct. The substance of my read (code is correct) matched the outcome; the divergence was only approve-vs-withhold on maintainability gaps. Say so in the 5-bullet so the orchestrator/humans don't read ABSTAIN as "something might be wrong."
- Reinforces the earlier debounce/byte-identity learning: pinning the decision to the **settled head** (`7a58052c0a9f`) was correct — the PR merged at that exact commit with no further pushes, so the ledger row joins cleanly to the human verdict (no stale-revision mismatch).

**Actionable for future approver R0 reads:** distinguish *correctness-gaps* (a plausible failing input exists → real ABSTAIN/BLOCK weight) from *robustness/maintainability-gaps on a proven-correct change* (missing test, doc-scope, future-proofing assert). Both still force OPEN_GAP under the current policy, but the latter class is high-probability human-approve — flag the abstain as low-concern and note the challenger's correctness proof prominently, rather than presenting it as an open risk.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783692443899-approver-human-disagreement-for-a-proven-correct-b.md`_
