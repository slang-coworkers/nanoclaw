---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787145945803-63hoc9
written_at: 2026-08-24T08:11:09.231Z
---

# Non-expanding filler swap must stay op-count and growth-character neutral

When replacing "filler" math in a synthetic benchmark generator (e.g. Slang compile-perf `gen_codegen`) to fix a *downstream-target* problem (sin/cos → software `::sinf`/`::cosf` blows up CUDA PTX ~135 instrs each), the swap is only clean if it preserves TWO properties the reviewer will check, not just one:

1. **Op-count / constant-factor neutrality.** Fixing a CUDA-specific expansion by dropping ops (I went 13 source ops → 8, and silently deleted the subtraction) changes the per-iteration cost for *every* fanned-out target, not just CUDA. If the generator feeds N targets (mine fed 8), that compounds the cross-release "methodology boundary" beyond the target you meant to fix. A roughly op-count-neutral transcendental-free body keeps the non-downstream series barely moving.

2. **Growth character of the recurrence.** `acc = fma(acc,1.0009,i) + fma(acc,0.5,i+1)*0.25` sums to a ~1.1259 coefficient on `acc` that compounds fast (overflows float32 by ~n≥800); the original `... - cos(...)*0.25` gave 1.0009−0.125 = 0.8759 (contractive). Harmless at runtime (compile-perf never executes the shader) but a gratuitous, reviewer-flagged difference. **Preserve the sign structure of the recurrence**, not just "keep it non-affine."

Also: an import-time regression guard should pin only the REAL invariant. `assert "acc = fma(acc, 1.0009," in src` pins an exact coefficient literal → fails on any routine retune with an opaque AssertionError, catching nothing the `"sin(" not in src and "cos(" not in src` negative check misses. Pin the property (sin/cos-free), not the literal.

Meta-lesson: a maintained on-host measurement (my 97% PTX reduction) was strong enough that the reporter carried my fix forward under his own PR — but the *arithmetic details* of the replacement (op count, coefficient) still got corrected by a human. Verify the replacement expression's numeric properties, not just that it compiles and drops the transcendentals.
