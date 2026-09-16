---
title: "Phase-ordering fixes: the shared consumer (choke point) often beats the producer; and verify 'regressions' against baseline"
type: learning
topic: verification
source: learnings/1789483453715-phase-ordering-fixes-the-shared-consumer-choke-poi.md
---

# Phase-ordering fixes: the shared consumer (choke point) often beats the producer; and verify "regressions" against baseline

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789014668312-eppmfy
written_at: 2026-09-15T14:44:13.715Z
---

# Phase-ordering fixes: the shared consumer (choke point) often beats the producer; and verify "regressions" against baseline

From shader-slang/slang#12987 (PR #12988) — a function-local struct's constrained generic method crashed `doesGenericSignatureMatchRequirement` because its `GenericTypeConstraintDecl` sub/sup weren't `SignatureChecked` yet (module-scope types get advanced before conformance checking; function-local types don't).

**Lesson 1 — consumer-side (choke-point) fix can be the correct, principled layer, even when a reviewer prefers the producer.** The maintainer preferred moving the fix from the matcher (`doesGenericSignatureMatchRequirement`) into the producer (`visitBlockStmt`, where local types are checked). But multiple independent paths reach that matcher WITHOUT going through `visitBlockStmt`:
  1. module-scope types checked on-demand via `tryConstantFoldDeclRef → ensureDecl(type, ReadyForConformances)` (e.g. a global array size `Wrapper<Data>::COUNT` referencing a later-declared type) — bypasses `checkModule`'s breadth-first loop entirely;
  2. generic local `struct Op<T>` is stored as a `GenericDecl` wrapper that `getDirectMemberDeclsOfType<AggTypeDeclBase>()` does NOT return — so a producer loop over agg-type decls skips it.
Because the matcher is the single choke point every generic-requirement match funnels through, establishing the invariant there (`ensureDecl(constraintDecl, SignatureChecked)` — constraint decls only, never the enclosing type mid-conformance → CyclicReference) covers all paths with one localized change. A producer-side fix covers only one path. **Before adopting a producer-side alternative to a consumer-side fix, enumerate ALL entry paths into the consumer and check the producer covers each.** codex CODE_REVIEW is excellent at reproducing the missed paths — use it.

**Lesson 2 — never conclude your change caused a full-suite regression without comparing to the clean baseline.** I ran a full regression on the alternative approach, saw "47 failures concentrated in tests/numerics/", and (wrongly, briefly) concluded it regressed core-module checking. They were PRE-EXISTING container-environment failures: `tests/numerics/` imports `slang.numerics`, which doesn't resolve in this container — the SAME 42 failures appear on the clean baseline (`git checkout HEAD -- <files>` + rebuild → identical list). The 5 non-numerics fails were CUDA-PTX/gfx-DLL/missing-tool env issues too. Root-cause the failures (read the actual first error, e.g. `E00001 cannot open file`), and diff the failure SET against baseline, before attributing anything to your diff.

**Bonus:** `SLANG_ASSERT` becomes `SLANG_ASSUME` (UB) in release (slang-common.h:371) — use `SLANG_RELEASE_ASSERT` for genuine fail-loud guards on out-of-contract input.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1789483453715-phase-ordering-fixes-the-shared-consumer-choke-poi.md`_
