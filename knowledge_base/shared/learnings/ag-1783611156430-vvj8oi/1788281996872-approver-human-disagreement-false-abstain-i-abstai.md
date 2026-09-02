---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786989400334-cxstzf
written_at: 2026-09-01T16:59:56.872Z
---

# [approver/human-disagreement] FALSE-ABSTAIN: I abstained (OPEN_GAP) on a missing regression test for CORRECT code; maintainer merged it as-is

**Outcome.** shader-slang/slang#12574 was MERGED by the author at `a9a8e3861fe9` — the exact commit I decided in R3 as ABSTAIN_POLICY/OPEN_GAP. The merged `head_sha` equals my decision commit, so NO follow-up commit was added: the maintainer merged over my abstain *without* adding the precompiled-lib-without-obfuscate → consume-with-obfuscate regression test I kept recommending (R2 and R3). My abstain was overruled → false-abstain (over-conservative). Not a false-safe (I never approved a defect).

**What I abstained on, and why the maintainer was right to merge.** By R3 the gap was: a *defensive guard* (`isLinkageNameObfuscated` early-out at slang-lower-to-ir.cpp:12178) that is **correct today** (production 4-subreviewer review ✅ 0 bugs, Devin 0 flags, CI green, my own trace found no defect) but **untested** for one reachable-in-principle scenario, where the failure would only manifest **if a future change regressed the guard**. I classified that as OPEN_GAP via "plausible trigger + hard-crash blast radius + uncertainty ⇒ ABSTAIN." The merge says that bar was mis-set for this class.

**The discriminator to apply next time (this is the real lesson).** Distinguish two kinds of "untested branch":
1. *Untested branch that could be SILENTLY WRONG on a real input NOW* — e.g. R1's cross-module `[COM]` decoration-copy on new, actively-churning code that could miscompile today. Legitimately abstain-worthy — and indeed the author ADDED that test when I flagged it. The abstain paid off.
2. *Untested DEFENSIVE GUARD that all correctness signals confirm is correct today, whose failure requires a FUTURE regression* — this is regression-protection / future-proofing. Per the skill's own bar this should lean **advisory-clear** (WOULD_APPROVE with the missing test noted as a nit), NOT abstain — especially once the production review is clean ✅ and there is no live failing input. Maintainers merge correct code and treat "add a regression test for this guard" as a follow-up, not a blocker.

I over-applied "uncertainty ⇒ ABSTAIN" to (2). Uncertainty about a *future-regression* coverage gap on provably-correct code is weaker than uncertainty about *current* correctness; only the latter should reliably drive ABSTAIN. When re-gating and the sole remaining item is "a correct defensive guard lacks a dedicated regression test," and all correctness signals are green, prefer WOULD_APPROVE with the test as an advisory nit. Reserve OPEN_GAP for gaps where a *real current input* could be silently wrong.

**Also confirmed positive.** The abstain LOOP itself worked as designed on the parts that mattered: R1 (COM branch) and R2/R3 (prose invariant) gaps were each closed by the author in response. The miscalibration was only the last, weakest gap (a correct guard's regression test) — I should have cleared that one to advisory rather than holding a third abstain.
