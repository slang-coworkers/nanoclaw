# Partition a count by the mechanism before using it as evidence for a fix

## "Six losses, therefore the bar is wrong" — the count was three different failure modes

Measured 2026-08-10 on shader-slang/slang-rhi. A PR-approver coworker escalated a real calibration problem: six consecutive ABSTAIN verdicts, all merged past, zero wins. It asked for a policy carve-out.

I endorsed the carve-out with a scope caveat. **It then audited my caveat and found the ask — its own — was over-claimed.** Partitioning the six rows by reason code:

```
#813 R1  OPEN_GAP              <- untested validation branch
#814 R1  ABSTAIN_INFRA         <- harness gap
#814 R2  CHALLENGER_CONCERN
#815 R1  OPEN_GAP              <- untested validation branch
#815 R2  OPEN_GAP              <- untested validation branch
#811 R1  NO_REVIEW_SIGNAL      <- harness gap
#811 R2  CHALLENGER_CONCERN    <- the author-declared-WIP case
```

**The proposed carve-out (author-declared WIP with clean artifacts) covers exactly one of six rows.** The real cluster is three untested-validation-branch calls — a genuinely different question — plus two harness gaps that no bar change can touch.

⇒ **Before publishing a count as evidence for a fix, partition it by the mechanism the fix addresses. If the partition is uneven, the count is not the evidence.**

A carve-out sized to "six losses" would be justified by evidence that mostly isn't about it. And n=1 cannot establish a rate, so that change has to be argued on principle (author intent belongs in the report, not the verdict) rather than as evidence-driven.

### The same generator, five instances across two agents in two days

**A claim true of one scope, published at another:**

- "forfeits nothing" — true of one subsystem, published as true of the world
- "upgrade" — true of the tree, published as available to a user
- "one merging maintainer" — true of the merger, published as the scope of the whole set (actually 3 authors)
- "the author isn't ready for review" — true of process, published as a claim about the artifact
- "six losses ⇒ one bar is wrong" — true of three modes, published as one

### Two distinctions that mattered, and the trap of applying one and not the other

**`merged_by` is an action, not a judgment.** In one case a merge with **zero review rows** was correctly scored as neither a win nor a loss: scoring agreement ("a human acted, as I said one must") is unfalsifiable; scoring a loss assumes review that zero rows cannot support.

**But the inverse also holds: a self-merge preceded by an independent approval is not an unreviewed merge.** One PR was discounted as weak evidence because `mergedBy == author` — while an independent APPROVED had landed 22 minutes earlier. The review happened; the author merely pressed the button.

⇒ **Check the review rows, not the merge button, in both directions.** The same agent applied the right rule in one chain and its inverse in another within the same hour — both times to its own cost.

### An abstain must still enumerate what it found

The most transferable finding: **a recusal that routes to a rubber stamp achieves nothing but a slower merge.** Three author-disclosed defects reached a human who left no review row, so nobody is on record as having adjudicated them.

⇒ **Declining to judge does not license declining to report.** An abstain's output must enumerate the open findings for whoever decides, or it transfers the decision without transferring the evidence.

