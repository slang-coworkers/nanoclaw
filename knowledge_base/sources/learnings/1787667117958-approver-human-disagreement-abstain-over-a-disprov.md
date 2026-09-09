---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786749174835-feop8m
written_at: 2026-08-25T14:11:57.958Z
---

# [approver/human-disagreement] ABSTAIN over a DISPROVEN Devin bug — human merged unchanged (#12548 R2)

**Join:** shader-slang/slang#12548 R2 @715dec4e MERGED unchanged (single commit, zero interval drift; merged_by jvepsalainen-nv, who also APPROVED the exact head). My decision was **ABSTAIN_POLICY(OPEN_GAP)**. Merged-unchanged ⇒ APPROVED-equivalent at my head ⇒ scored against the falsifiable reading ("material enough not to merge as-is"), this is a **FALSE ABSTAIN**.

**What happened:** Test-only PR (+40, FileCheck guard). Devin-only tier. Head-current Devin raised an OPEN "Potential Bug" ("CUDA test always fails on prelude for-loops"). I DISPROVED it with dispositive evidence: (a) the CUDA prelude is `#include`d, not inlined, so FileCheck never sees its `for (` loops; (b) CI ran+passed all three GLSL/Metal/CUDA directives on the exact head (`unroll.slang`/.1/.2, none ignored). A test that "always fails" cannot pass. So the code was fine — and the human agreed by merging unchanged.

**Why I abstained anyway (the tension):** The decision procedure bars using investigation to upgrade a reviewer-flagged 🔴 toward approval (Step 3), so WOULD_APPROVE was off the table; and BLOCK requires a *verified* 🔴, which this was NOT (it was disproven), so BLOCK would be untruthful. The residue is ABSTAIN_POLICY.

**Is the abstain "wrong"? No — it is the SAFE error, and the procedure worked as designed:** the Step-3 false-safe guard (can't self-clear a 🔴) exists to stop me rationalizing away REAL bugs; here it fired on a FALSE-positive bug and produced an over-conservative abstain (no false approve, human resolved it correctly). The lesson is NOT "clear 🔴s more aggressively" (that reintroduces false-approve risk). The transferable signals:
1. **Devin's false-positive rate on FileCheck/emit-shape reasoning is a real source of over-conservative abstains.** Its CUDA-prelude-inlining premise was simply wrong for SIMPLE `-target cuda` output. When a Devin "bug" rests on an emitter-behavior claim, verify the claim against actual compiled output / CI before weighting it — but the verification can only justify an ABSTAIN vs BLOCK split, not an approval.
2. **The strongest disproof of a "test always fails" claim is the test's own passing CI run on the exact head** — cheaper and more authoritative than local repro (my local slangc was pre-#12417 and misled me with stale un-unrolled loops). Reach for the CI log first.
3. **Two tooling defects nearly flipped this the other way**: the auto-scrape mis-parsed 1 Bug+1 Flag to "0/0" (would have been a FALSE APPROVE over an open bug), and the first Devin run was a stale R1 cache. Both were caught only by the critique gate, not the tooling. The gate earned its keep here.

**Net:** a false abstain is the acceptable failure mode of a shadow-mode approver; the data point for policy owners is that false-positive reviewer findings on test-only PRs drive abstains that humans routinely overrule by merging. Related: [[pr-12548-r2-decided]], and the two Devin-fetch defect learnings (stale-cache; tab-parse).
