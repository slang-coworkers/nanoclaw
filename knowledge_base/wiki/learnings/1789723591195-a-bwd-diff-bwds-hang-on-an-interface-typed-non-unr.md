---
title: "A bwd_diff .bwds() HANG on an interface-typed non-unrollable loop is a target-specialization fixpoint, NOT an autodiff bug"
type: learning
topic: slang-compiler
source: learnings/1789723591195-a-bwd-diff-bwds-hang-on-an-interface-typed-non-unr.md
---

# A bwd_diff .bwds() HANG on an interface-typed non-unrollable loop is a target-specialization fixpoint, NOT an autodiff bug

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789716151214-yz6n7y
written_at: 2026-09-18T09:26:31.195Z
---

# A bwd_diff .bwds() HANG on an interface-typed non-unrollable loop is a target-specialization fixpoint, NOT an autodiff bug

Triaging shader-slang/slang#13169 (bot-filed, labeled `Autodiff`+`regression`): reverse-mode `bwd_diff`/`.bwds()` of a `[Differentiable]` function whose loop has a **runtime (non-constant) bound / runtime `if` / `break`** and reads through an **interface-typed** differentiable view (`IDiffTensor`/`DiffTensorView`) **hangs indefinitely**. The issue AND my own refined hypothesis both anchored on the autodiff primal-hoist reverse counter (`collectLoopExitConditions` constant-offset guard `:1170`, `lowerIndexedRegion` `diffCountParam`). **Both were the wrong subsystem entirely.**

REAL root cause (slang-fixer + slangpy-fixer, gdb + source, triple-corroborated): a **non-terminating target-specialization fixpoint** in `linkAndOptimizeIR`, *after* autodiff — `SpecializationContext::processModule`'s `for(;;)` (`slang-ir-specialize.cpp:1832`, exit `:1904` on `!iterChanged`) never converges because `performDynamicInstLowering` (`slang-ir-typeflow-specialize.cpp`) re-reports a change every round for a **loop-carried phi typed `TagType(IRWitnessTableSet)` feeding a set-specialized `IRSpecialize`** — a shape *deliberately excluded* from the structural fixed-point set (`slang-ir-translate.cpp:514-517` records fixed points only for `IRSetBase`; a set-specialized `Specialize` is documented "non-monotonic"). Owner = **typeflow/target-specialization (jvepsalainen-nv)**, not autodiff/saipraveenb25. #12299 (the #12070 autodiff-start fix) fully refuted as suspect.

DISCRIMINATORS that pin it (use these to route fast next time): (1) the hang is **compile-time / CPU-bound (GPU 0%)** — a non-terminating fixpoint, not a runtime GPU kernel loop; asking "compile-time vs GPU-dispatch?" is the key early question. (2) **Unrollable ⇒ converges, non-unrollable ⇒ hangs:** a literal `i<5` (or `[ForceUnroll]`) loop compiles fine because `unrollLoopsInModule` produces finite concrete witness tables with no loop-carried existential; only a `[MaxIters]`-bounded runtime loop over an interface type keeps a live witness-table-set. (3) forward pass ok, no ICE/wrong-value. Minimal GPU-free repro is `slangc -target cuda` on an `interface ITensorView { [Differentiable] float read(...); }` with a `[MaxIters(17)] for(i<n)` differentiable loop — NO `import slangpy` needed.

LESSON: for reverse-mode autodiff of interface/dynamic-dispatch code, a **hang** (as opposed to an ICE or a wrong gradient) is a strong tell for the specialization/typeflow fixpoint, not the autodiff transform itself — the autodiff-generated kernel is only the trigger context. A well-hedged root-cause hypothesis can still be entirely the wrong subsystem; the GPU-free repro + bisect is what actually pins it, so recommend "localize before fix." Candidate fix = make the set-specialized `Specialize`/witness-table-set lowering idempotent (set-equivalence fixed point), NOT a bare iteration cap (which masks and risks miscompile). Distinct from #13000 (nested-`[MaxIters]` *wrong gradient*, `getTypeForLocalStorage` dimension fold, PR #13002).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789723591195-a-bwd-diff-bwds-hang-on-an-interface-typed-non-unr.md`_
