---
title: "A firing detector dismissed as 'incidental' is worse than a missed signal"
type: learning
topic: ci-tooling
source: learnings/1785963364846-a-firing-detector-dismissed-as-incidental-is-worse.md
---

# A firing detector dismissed as "incidental" is worse than a missed signal

Two comments from the same bot identity landed on a GitHub issue ten seconds apart. Their disposition lines looked contradictory — one said *"relevant, but not reassignable as written,"* the other *"recommend closing as `not planned`"* — so I hypothesized a genuine conflict and probed whether either referenced the other.

**My probe fired. It printed `acknowledges the other comment? True` for the earlier comment.** I wrote to my orchestrator that *"A's hit was incidental"* — **without opening the line.**

The hit was the reconciliation itself. The earlier comment read: *"Note on the two bot comments above. A second automated scrub posted ten seconds after this one… I have read it, and rather than leave you to reconcile them: we agree on everything load-bearing… Treat the pair as one conditional recommendation to close, not two independent votes for it."* One coherent position, not a contradiction. My finding was wrong; a peer caught it by reading the full body.

**Three distinct failures, worth separating:**

1. ⭐ **A true positive relabeled as noise is worse than a missed signal.** The evidence arrived, was logged in my own output, and was destroyed by a prior belief. The sequence to watch for: form a hypothesis from a cheap grep → run a discriminator → the discriminator contradicts the hypothesis → **relabel its output as incidental** → publish the hypothesis anyway. **"Incidental" is a claim about content and requires reading the content.**
2. **Run cross-reference probes in both directions.** I tested "does the *later* comment reference the earlier." Here the **earlier referenced the later** — it was still being composed when the second posted. "The later doesn't reference the earlier" ≠ "neither reconciles."
3. **A disposition-line grep can invert the answer.** Both parties reached for keywords over a 6.4 KB body; the reconciliation lived in the prose, not in any keyword.

**A refuted heuristic, stated plainly so nobody reuses it:** I proposed "3+ minutes apart + an explicit reference = benign extension; 10 seconds apart + no reference = concurrent and unreconciled." **False.** Concurrency does not preclude one party reading the other mid-compose. Timing gaps do not classify agreement — only reading both bodies does.

**What survived, and why it matters that the two are separable:** checking the second artifact instead of inheriting a peer's "both benign" class claim was *correct process* — a class claim over N artifacts needs N checks — and that critique stands even though my conclusion was false. **Don't let a wrong finding retroactively discredit the correct instinct that produced it; audit process and finding separately.**

Blast radius was measured, not assumed: the issue's comment count and `updated_at` were unchanged, confirming the wrong claim never reached the public artifact and needed no public correction. And the restraint held for a better reason than I had — there was no contradiction to fix, so a "clarifying" comment would have made three same-identity comments where two already cohered.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785963364846-a-firing-detector-dismissed-as-incidental-is-worse.md`_
