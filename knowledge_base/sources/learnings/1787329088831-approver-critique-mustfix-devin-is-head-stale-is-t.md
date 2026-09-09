---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787273068610-gcdnaz
written_at: 2026-08-21T16:18:08.831Z
---

# [approver/critique-mustfix] "Devin is head-stale" is the ABSTAIN condition itself — not a license to approve on my own source read

**Correction to a same-session learning.** Earlier this session I recorded that on a re-synchronized PR, a Devin doc-🔴 keyed to code the revision REMOVED is "stale, not a live block." That is TRUE about the individual bug — but I then used it to drive toward WOULD_APPROVE, and DECISION_REVIEW (codex) correctly reversed me to ABSTAIN_POLICY/CRITIQUE_MUSTFIX. This atom records the corrected rule.

**The error (shader-slang/slang #12417 R2 @48bc99b029a6):** Harvest exit 20 (bot fixer branch ⇒ no production/CodeRabbit review). The only review signal was Devin, whose analysis was HEAD-STALE (it described the prior revision; commit-status "unknown") and still carried a "Bug" entry. I verified in source that the bug was on removed code and that the diff was clean, then drafted WOULD_APPROVE. Two independent rules say that's wrong:
1. The challenger may NOT upgrade past a review-doc 🔴 toward approval (skill Step 3 + [approver/challenger-miss-averted]). A doc-🔴 proven spurious resolves to ABSTAIN(CRITIQUE_MUSTFIX), never a silent upgrade to approve.
2. **"The review signal is stale" is itself the abstain condition** — it means I hold NO demonstrably head-current, clean review signal. "Inability to complete the check ⇒ ABSTAIN." My own reading of the diff/source is the CHALLENGER's input; it is NOT a substitute review tier. The approver decides FROM a review doc; it does not manufacture the review by reading the code itself.

**The tell I missed (fires before the error):** I wrote "Devin's analysis is STALE" into my own review-doc — a past-tense claim that the instrument I depend on did not actually cover the head — and then kept driving toward approve anyway. The moment I diagnose my review signal as not-head-current on a tier where it's the ONLY signal, the decision is already an abstain; continuing to a positive verdict is substituting my source read for the missing review.

**Why a strong human approval doesn't rescue it:** a MEMBER had formally APPROVED at the exact head. That does NOT let the approver round up — accuracy is measured, the approver never rounds to approve, and the human verdict is captured on the join. Abstaining here loses nothing (the human already approved); approving on a stale signal would have been an unearned positive claim.

**How to catch it:** On the Devin-only tier, before deriving any WOULD_APPROVE, confirm the Devin result is demonstrably head-current (commit-status matches the pinned SHA; prose references the CURRENT diff's constructs, not removed ones). If it's stale or carries an unresolved 🔴 you can only clear by your own code read, the terminal is ABSTAIN (CRITIQUE_MUSTFIX / NO_REVIEW_SIGNAL-adjacent), and you note the infra gap: no head-current review signal on this bot fixer branch. The fix for the SIGNAL is a fresh head-current Devin run, not a challenger override.
