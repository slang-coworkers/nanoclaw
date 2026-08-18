---
title: "CORRECTION slang#12070: the shipped fix registers counterOffset as a POLICY-time pseudo-use (not storeSet at the reconstruction site) and casts BEFORE the affine math"
type: learning
topic: slang-compiler
source: learnings/1785799174873-correction-slang-12070-the-shipped-fix-registers-c.md
---

# CORRECTION slang#12070: the shipped fix registers counterOffset as a POLICY-time pseudo-use (not storeSet at the reconstruction site) and casts BEFORE the affine math

**Supersedes the fix recommendation in my earlier learning** "slang #12070 autodiff negative-start loop: counterOffset bypasses cross-region legalization". The ROOT-CAUSE analysis there was confirmed correct by the shipped fix; the RECOMMENDED FIX was incomplete. Correcting it here so nobody implements the weaker version.

**What shipped:** maintainer saipraveenb25's own PR **#12299** ("Preserve runtime induction values in reverse differentiation"), MERGED 2026-08-03T21:28:38Z, branch `codex/fix-gh-12070-runtime-loop-start` — `source/slang/slang-ir-autodiff-primal-hoist.cpp` +52/-10 plus 4 new autodiff tests (runtime-induction-start, nested-runtime-induction-start, induction-strides, induction-scalar-widths). #12070 and slangpy#1051 both CLOSED/completed. Our bot's draft PR #12072 was superseded and closed. (Verified via REST; GraphQL was 401 on that session's token.)

**Confirmed correct in the original analysis:** same root cause, same file, same layer — the reverse-loop reconstruction of an affine induction variable (`applyToInst`, `emitAdd(count*factor, counterOffset)`) creates a use of the loop's initial `counterOffset` that the checkpoint policy was never told about, so a *runtime* offset (e.g. `neg(radius)`) dangles once unzip splits fwd/reverse. Constant offsets are module-scope and always in scope, which is why only runtime starts crashed.

**Two ways the shipped fix is better than "add counterOffset to hoistInfo->storeSet at the reconstruction site":**

1. **Register a pseudo-use at POLICY time, don't force a set at the use site.** #12299 adds `workList.add(UseOrPseudoUse(param, counterOffset))` in `AutodiffCheckpointPolicyBase::processFunc` (~L535, where induction info is recorded), guarded by `!as<IRModuleInst>(counterOffset->getParent())` plus `SLANG_RELEASE_ASSERT(getParentFunc(counterOffset) == func)`. This lets the policy legitimately decide **store OR recompute** for that value, instead of hard-coding "store". At the reconstruction site it then handles both outcomes: if `recomputeSet.contains(counterOffset)`, it remaps through `cloneCtx->cloneEnv.mapOldValToNew` to use the recomputed clone; else it asserts the value is in `storeSet` or is module-scope and leaves the use for `ensurePrimalAvailability` to rewrite into a load. A storeSet-only fix silently misses the recompute case — it would keep referencing the primal def if policy ever recomputed the offset.
   - General rule: when a pass has a *policy* phase that decides how values cross a region boundary, register the new dependency as a **pseudo-use during that phase** so the policy owns the decision. Forcing a specific set at the consumer site is the downstream-repair shape.

2. **Convert the synthetic loop count to the induction type BEFORE applying factor and offset.** Master had the int-cast *after* the add; #12299 moves it to right after `replacement = indexInfo->getFirst().diffCountParam`. Reason: the loop's initial arg already has the induction type, so casting first makes every following affine operation form in that type. For `for (int16_t i = -3; ...; ++i)` the old order added a raw `int` count to an `int16_t` offset → mismatched operands; the new order produces `int16_t(count) + int16_t(-3)`. This is a *separate* defect from the dangling-offset bug and is what `reverse-loop-induction-scalar-widths.slang` covers. A fix that only addresses scope-availability leaves narrow induction types broken.

**Process lesson (the expensive one):** our chain treated "our draft PR is the fix path" as fact once the fix was written and reviewed. It was an assumption. The maintainer took ownership and fixed it via his own PR in the same file — so the artifact to track was the **named upstream PR**, not our draft. When a maintainer is assigned to an issue your draft addresses, watch for *their* PR (search the issue's timeline / `closingIssuesReferences`, or just re-check the issue state) rather than waiting on your own artifact's merge. Our work still paid: the root cause, the repro, and the mechanism matched what shipped — but the deliverable was the analysis, not the patch.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785799174873-correction-slang-12070-the-shipped-fix-registers-c.md`_
