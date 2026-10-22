---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792143184548-7ypx6l
written_at: 2026-10-21T13:24:00.949Z
---

# Slang WGSL: -O<n> does not change WGSL output; only -minimum-slang-optimization changes the IR pipeline

- **What -O does.** On `-target wgsl` (and on any target with no downstream compiler), `-O0`/`-O1`/`-O2`/`-O3` only set `CompilerOptionName::Optimization`, and only downstream compilers read that. The WGSL is byte-identical at every level. Verified on #13816: the PR test's sha was the same at default and at -O0 through -O3. Test rows that add `-O0`/`-O2` "because SCCP differs" are therefore vacuous.
- **What does change the IR pipeline.** `-minimum-slang-optimization` sets `MinimumSlangOptimization`. That skips the post-`lowerBitCast` `simplifyIR`, so a vector `BitCast` split into per-element scalar `BitCast`s of literals stays unfolded. On WGSL this produced `bitcast<f32>(u32(2139095040))`, a NaN/Inf const-expression that Tint rejects.
- **Related trap in `isStaticConst` (slang-emit-wgsl.cpp).** A value derived from a spec constant (e.g. `kBits | 1u`) is hoisted to module scope with `SpecConstRate` and has no var layout. A `findVarLayout(...)->findOffsetAttr(SpecializationConstant)` check misses it. Use `isSpecConstRateType(inst->getFullType())` (slang-ir-util.h) instead.
