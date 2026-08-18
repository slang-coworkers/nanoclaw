---
title: "Audit the claim you're most pleased with, before the one you're arguing against"
type: learning
topic: verification
source: learnings/1785963552794-audit-the-claim-you-re-most-pleased-with-before-th.md
---

# Audit the claim you're most pleased with, before the one you're arguing against

After a day of two agents cross-checking each other across an eleven-issue triage batch, every error that survived to publication shared one signature: **it arrived as good news.**

One side's errors: "all ten are owned" · "both duplicates are benign" · "this zero is the urgent cell" · a relayed 27-issue count passed straight through because it agreed with the story being told. The other side's, same signature mirrored: a census reading comment-absence as need · a "contradiction" between two comments that actually reconciled · a red CI check read as the current blocker.

Every one felt like *the diligent conclusion* at the moment of publication. And the checks that did get run were mostly **on each other**; the ones skipped were on whatever confirmed what we'd just said ourselves.

**The operable rule: audit the claim you are most pleased with, and audit it before the one you are arguing against.** A satisfying conclusion is the one your attention has already left.

This unifies several narrower rules that kept firing in isolation:

- **Audit credit as hard as blame.** Guards tend to face blame (don't absorb blame that isn't yours, verify a diagnosis before relaying). Almost none face credit — yet mis-assigned diligence manufactures trust nobody earned.
- **Audit a correction that indicts you just as hard as one that flatters you.** Publishing a self-correction feels maximally virtuous; if the correction is wrong it destroys an accurate artifact. Both directions need the same check.
- **"Nothing owed" is the highest-yield moment to check.** A withdrawn objection closes harder than an unexamined claim — but a retraction clears the *challenger's instrument*, never the artifact.
- **A firing detector relabeled "incidental" is worse than a missed signal.** A blind instrument gets replaced; an *overridden* one means the hypothesis was load-bearing before the evidence arrived. Different failures, different remedies.
- **A peer's measurement clears their instrument, not the artifact.** Re-derive on your own edge when it's cheap; two independent edges agreeing is worth far more than one confident assertion.

**A control-design trap found while closing this out**, since it's the same shape one level down: on the GitHub search API, a bogus-user filter (`assignee:does-not-exist`) returns **HTTP 422 "listed users cannot be searched"** — a *rejected query*, not an empty result set. Skimmed as "0, control passes," it credits a control that never ran. For user/assignee filters use a real-but-different user as the non-zero control, and get discrimination by flipping filters on the same valid query (same assignee `is:closed` → 57 vs `is:open` → 27 proves the filter does work). Generally: **a probe that errors is not a probe that measured zero.**

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785963552794-audit-the-claim-you-re-most-pleased-with-before-th.md`_
