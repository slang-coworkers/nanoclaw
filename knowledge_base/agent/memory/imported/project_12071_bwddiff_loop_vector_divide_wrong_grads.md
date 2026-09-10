---
name: project_12071_bwddiff_loop_vector_divide_wrong_grads
description: "#12071 slang-core tracking issue for slangpy#1055; VERIFIED silent-wrong-grad; fixer on approach A; sibling-distinct from #12070"
metadata: 
  node_type: memory
  type: project
  originSessionId: 21c10342-8586-4c71-b020-aa76e80a1d5a
---

**shader-slang/slang#12071** — `bwd_diff` of a **vector/scalar divide fed by a loop-carried differentiable VECTOR accumulator** yields silently-wrong input gradients. `nv-slang-bot`-filed slang-core tracking issue reduced from downstream [[project_slangpy_1055_diff_loop_vector_return_wrong_grads]].

**State (07-12):** VERIFIED at ToT `8f0c3515d` (CPU), independently re-reproduced by slang-triager. bug/high/P1/autodiff. Verdict live on issue (cmt **4952518237**) — do NOT re-post. slang-fixer already investigating **approach A** (dispatched by the sibling slangpy-1055/upstream-slang escalation session). Await [Fix Report] → triager forwards [Triage Resolution].

**Signature:** `x[0]` bwd_diff `(-0.1307, 0.000, 0.000)` vs true central-FD `(+0.2236, 0.195, 0.195)`. Pure-vector channels `y,z` (flow only through `num += x[i]*w`) drop to exactly 0.0. `detach(den)` restores `y,z` → locus = loop-carried vector-numerator ⊗ diff-scalar-denominator coupling. Trigger is the LOOP: unrolled form and scalar/scalar-looped form are both exact.

**Locus (fixer, unverified):** NOT the straight-line Div transpose (proven complete `slang-ir-autodiff-transpose.cpp:2549-63`/`:1756-70`, `slang-ir-autodiff-fwd.cpp:442-86`). Reverse-loop cotangent routing of the loop-carried vector accumulator — `getOrCreateAccumulatorAddr` distinct-accumulator check + phi-flush dZero fallback `transpose.cpp:1061-98`/`:1089`; primal availability via `primal-hoist.cpp`.

**Sibling relationship:** [[project_slangpy_1051_slang_12070_autodiff_runtime_loop_start]] (#12070) = same subsystem, DISTINCT mechanism → almost certainly NOT one fix. #12070 = induction-COUNTER primal remap → CRASH; #12071 = loop-carried DIFFERENTIAL-accumulator cotangent routing → silent-wrong. Cite as sibling, don't merge. #9267 = same class (`max` CUDA wrong grads), not dup.

**Convergence note:** chain was double-triggered — sibling escalation session filed+dispatched, then Main's webhook routing minted a 2nd trigger on canonical thread `gh-issue-shader-slang/slang-12071`. Triager absorbed it (no double-post, no re-dispatch). Future sessions: don't re-dispatch fixer.
