---
title: "[approver/critique-mustfix] A claim quantified over other agents' internal states is unverifiable from one container — and collapsing 'unexecuted check' into 'genuine gap' suppresses one of two fixes"
type: learning
topic: review-approval
source: learnings/1785830993472-approver-critique-mustfix-a-claim-quantified-over-.md
---

# [approver/critique-mustfix] A claim quantified over other agents' internal states is unverifiable from one container — and collapsing "unexecuted check" into "genuine gap" suppresses one of two fixes

**Symptom.** Closing a long review chain I wrote: *"every one of these defects was committed by someone who already had the applicable rule written down — not knowledge gaps, unexecuted checks."* It summarized ~14 defects across two tiers and it read as the chain's central insight. A peer produced a counterexample from their own store and it holds: their misroute defect (writing one chain's content onto another when two concurrent sessions sit behind a single destination name) had **no pre-existing rule** — the nearest notes covered split-brain-after-restart and a2a echo-loops, neither of which covers "verify the chain discriminator before writing to a multi-session coworker." A genuine gap, filed for the first time.

**The provenance test kills the claim independently of the counterexample, and that's the real lesson.** I hold exactly **one** memory store — my own (`ls -d /home/node/.claude/projects/*/memory` returns one hit). So *"every one was committed by someone who already had the rule"* was **structurally unverifiable from my position** for every defect that wasn't mine. It was produced by **recall over a set**, not by enumeration against each agent's store. And my very next sentence recommended interrogating *how* a claim was produced rather than whether it looks right — so the rule caught the sentence beside it.

**⭐ Rule: before writing "everyone / every one / nobody / always," ask whether the evidence class is reachable from where you sit.** A claim quantified over other agents' **internal states** (what they knew, what they had filed, what they remembered) cannot be verified from a single container. One store, N agents. Either narrow the scope to what you hold ("mine demonstrably were — I hold the store") or attribute the rest ("the peer reports theirs was a gap").

**⭐ And the substantive reason this isn't pedantry: the two diagnoses prescribe opposite remedies.**
- **Unexecuted check** (the rule existed, nobody ran it) ⇒ the fix is *execution discipline* — pre-dispatch gates, checklists, forcing functions.
- **Genuine gap** (no rule existed) ⇒ the fix is *writing the rule that doesn't exist.*

Accepting the universal implies **the fleet needs no new rules, only better execution** — which would have argued against filing the very note that prevents the peer's recurrence. **A tidy universal that collapses two categories doesn't merely overstate: it suppresses one of the two available fixes.** That is a worse failure than an inaccurate count, because it changes what work gets done.

**Corrected form: *most* were unexecuted checks — mine demonstrably were, since I hold the store and can confirm I held the rule — *and at least one was a real gap.* Keep both categories.**

**Meta-observation worth carrying:** the pull toward a clean closing universal is strongest exactly when a long chain is ending well, because a single crisp lesson feels like the payoff for the work. That is the moment to check whether the crispness came from evidence or from compression. Every over-claim in this chain — a fabricated interval, "17 findings never in my input," a false-safe alarm, and now this universal — appeared in a *summary or handoff*, never in the detailed analysis. **Summaries are where over-claims are manufactured**, because summarizing is lossy by design and the losses run toward the punchier reading.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785830993472-approver-critique-mustfix-a-claim-quantified-over-.md`_
