---
title: "CORRECTION: bwd_diff-over-interface specializeModule hang on MASTER is a type-spelling canonicalization ping-pong, not a witness tower (scopes the earlier tower learning to the #9808 era)"
type: learning
topic: slang-compiler
source: learnings/1790148738722-correction-bwd-diff-over-interface-specializemodul.md
---

# CORRECTION: bwd_diff-over-interface specializeModule hang on MASTER is a type-spelling canonicalization ping-pong, not a witness tower (scopes the earlier tower learning to the #9808 era)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790100963214-495iid
written_at: 2026-09-23T07:32:18.722Z
---

# CORRECTION: bwd_diff-over-interface specializeModule hang on MASTER is a type-spelling canonicalization ping-pong, not a witness tower (scopes the earlier tower learning to the #9808 era)

Corrects/scopes the earlier learning "bwd_diff over an existential/interface differentiable param hangs specializeModule (not fwd) — higher-order witness tower" (slang#13226). Maintainer **jkwak-work instrumented specializeModule on master (afeaf511c) and MEASURED the loop** (issue #13226, comment 5790779225) — the earlier "unbounded higher-order derivative-witness synthesis (tower)" was a source-consistent HYPOTHESIS, and the measurement refutes it on master.

**Master mechanism = a type-spelling canonicalization PING-PONG in typeflow specialization (NOT runaway synthesis):**
- Round 1 does real work; round 2+ report `drains=0`/`unrolled=0` yet `specializeDynamicInsts` returns `true`, so the outer `for(;;)` in `SpecializationContext::processModule` never exits. Module grows by exactly **+2 insts/round** from one function (`s_bwdProp_<fn>` via `specializeFunc`→`specializeInstsInBlock`); the same 4 insts flip forever (defaultConstruct/store/packAnyValue/store).
- The backward pass materializes the loop accumulator's differential behind a `var` whose pointee is the one-element `UntaggedUnionType({S})` spelling of the concrete differential `S` (single conformance). Two rules in `slang-ir-typeflow-specialize.cpp` disagree: `replaceType` assigns `getLoweredType` which **collapses** a one-element union to its element (`S`); `handleDefaultStore` + the `upcastSet` path in `specializeStore` target the destination's **raw** pointee and rewrite it **back** to the union (upcastSet mints a fresh `packAnyValue` each round = the +2). Each undoes the other → `performDynamicInstLowering` reports a change forever. The `var` carries no type-flow info (`ptrHasInfo=0`) so the un-canonical spelling survives every round.
- **DECISIVE discriminator: witness-table and function counts are FLAT** (`wtable=35 func=122` unchanged round 2 → 1000+). Flat counts ⇒ no witness/function synthesis ⇒ the "tower" hypothesis is wrong for master. (Lesson: a slow, unbounded specializeModule loop is not necessarily synthesis — measure inst-count growth AND witness/func counts before asserting a mechanism.)

**The tower hypothesis may still describe a DIFFERENT era:** the #9808-era (45ccce9a3) *Release* `STATUS_STACK_OVERFLOW` is a genuinely different shape (unbounded recursion) from master's flat, slow-growth non-termination — the manifestation changed over the intervening year. So the earlier learning isn't "wrong," it's **mis-scoped**: treat it as the #9808-era Release-stack-overflow shape, not the master mechanism.

**Fix (principled, value-layer):** route the store destination's pointee through `getLoweredType` once in `specializeStore` and hand that canonical type to `handleDefaultStore` (both write the same spelling → converges); same denotation (`lowerUntaggedUnionTypes` does this collapse later in the pipeline). Deliberately do NOT collapse singleton sets inside `getUntaggedUnionType` — the union type carries set-lattice meaning ("a set-typed value with one possibility") distinct from a bare concrete type; erasing it at construction would change dispatch/marshalling. The defect was writing a non-canonical type onto a *value*, which is the layer the fix sits at. Regression: `tests/autodiff/interface-param-loop-backward.slang` (SlangPy-free, 40 lines).

**Meta-lesson (verification discipline):** this is a textbook "wrong mechanism behind a right conclusion" — the "specializeModule outer fixpoint never converges / specializeDynamicInsts true forever" framing was correct, but the specific mechanism (witness tower) was a hypothesis stated with too much confidence. A hypothesis "source-consistent with reading the code" is not a measurement; instrument the loop (inst-count delta, which insts flip, witness/func counts) before naming the mechanism in a public triage comment.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790148738722-correction-bwd-diff-over-interface-specializemodul.md`_
