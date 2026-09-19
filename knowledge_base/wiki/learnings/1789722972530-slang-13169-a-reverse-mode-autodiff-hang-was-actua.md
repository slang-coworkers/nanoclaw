---
title: "slang#13169: a reverse-mode autodiff 'hang' was actually a type-flow specialization fixpoint (not autodiff)"
type: learning
topic: slang-compiler
source: learnings/1789722972530-slang-13169-a-reverse-mode-autodiff-hang-was-actua.md
---

# slang#13169: a reverse-mode autodiff "hang" was actually a type-flow specialization fixpoint (not autodiff)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789716207340-dwbdoz
written_at: 2026-09-18T09:16:12.530Z
---

# slang#13169: a reverse-mode autodiff "hang" was actually a type-flow specialization fixpoint (not autodiff)

A `bwd_diff` "hang" on a `[Differentiable]` runtime-bound loop over an `IDiffTensor` (SlangPy #1167 → slang #13169) was hypothesized (issue, triager, and me) to be an autodiff reverse-loop counter bug in `slang-ir-autodiff-primal-hoist.cpp`. **All three were wrong.** gdb on the live compile (CPU-bound, GPU 0%) showed it is a **non-terminating TARGET-SPECIALIZATION fixpoint**, AFTER autodiff, in `linkAndOptimizeIR`.

**Root cause (HEAD 55e3dbdd7):** `SpecializationContext::processModule`'s `for(;;)` at `slang-ir-specialize.cpp:1832` exits only at :1904 `if(!iterChanged||errors)break`. `dynPassChanged` (:1891/:1901) = solely `hasChanges` from `specializeDynamicInsts`→`TypeFlowSpecializationContext::performDynamicInstLowering` (`slang-ir-typeflow-specialize.cpp:8533/8375/5638`). It re-fires a change EVERY round on a **loop-carried phi typed `TagType(IRWitnessTableSet)` feeding a set-specialized `IRSpecialize`** — a shape `_resolveInstRec` itself classifies as **non-monotonic** and excludes from `resolvedStructuralFixedPoints` (`slang-ir-translate.cpp:514-517`, rationale in translate.h:81-84). `specializeFunc`'s loop-carried phi-arg upcast (:5351/:5360) / effective-func-type mismatch (:5400) never stabilizes ⇒ infinite loop. An **interface** type (`IDiffTensor`) ⇒ dynamic dispatch. A **fixed** literal bound unrolls (`unrollLoopsInModule` :1865, warns E30519) → finite concrete witness tables → converges; a **runtime**/`[MaxIters]`-only bound can't unroll → never idempotent → hangs. gdb "hot" frames (`performInformationPropagation`/`_resolveInstRec`/`getIntValue`) are the TIME-SINK (context rebuilt each round at :8531 → empty fixed-point set → full re-walk), NOT the change driver — don't confuse the two.

**Reusable techniques:**
1. **gdb on a live compile pins a CPU-side compiler hang far faster than pass-bisection.** For SlangPy: `PipelineCompilationPolicy.immediate` forces eager codegen on the calling thread; `prctl(PR_SET_PTRACER)` beats `ptrace_scope=1`. For bare slangc: have gdb LAUNCH slangc (gdb=ancestor satisfies ptrace_scope=1), run in bg, `kill -INT <gdbpid>` to break the inferior so the queued `-ex bt` fires (gdb-attach as a SIBLING fails under ptrace_scope=1).
2. **A minimal pure-Slang GPU-free repro DID exist** — prior attempts failed because they modeled the *autodiff* shape (value arrays / scatter-add) which all compile fine. The real trigger is a `[Differentiable]` non-unrollable runtime loop calling a `[Differentiable]` method through an **interface-typed value** + `bwd_diff` + `-target cuda` (lowers witness lookups). ~55 lines, no slangpy import. When "no minimal repro exists," re-check you're modeling the RIGHT pass.
3. **`import "slangpy"` + a `bwd_diff` wrapper hangs bare slangc at `diagnoseCircularConformances`** (a SEPARATE confound that hits BOTH runtime and fixed, before specialization) — precompiling modules does NOT dodge it. Capture faithful kernels/IR through SlangPy's own linked session, or use a slangpy-free minimal repro.
4. **Release-tag DATES ≠ version-number intuition.** `v2026.12` was tagged 2026-06-25; #12299 merged 2026-08-03 (first in v2026.16). A claimed "regression window (2026.5.2, 2026.12] straddles #12299's merge" was false — #12299 is entirely AFTER the window. Always `git merge-base --is-ancestor <commit> <tag>` + check tag commit dates before trusting a "window straddles commit X" claim.
5. **Env:** system python often lacks dev headers → `uv python install` gives a standalone CPython with headers; SlangPy/sgl bundles glfw 3.3.10 which needs X11 dev libs (`xorg-dev` + libxinerama/xcursor/xrandr/xi) even for a headless CUDA compute build (no headless glfw option in 3.3.x).

Owner of the faulting code: git-blame ⇒ Jussi Vepsalainen (NVIDIA) owns `slang-ir-typeflow-specialize.cpp` — a typeflow/specialization fix, NOT saipraveenb25/autodiff. Fix direction (unimplemented): make the set-specialized `Specialize`/witness-table-set lowering idempotent (structural-equivalence fixpoint), not a naive iteration cap.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789722972530-slang-13169-a-reverse-mode-autodiff-hang-was-actua.md`_
