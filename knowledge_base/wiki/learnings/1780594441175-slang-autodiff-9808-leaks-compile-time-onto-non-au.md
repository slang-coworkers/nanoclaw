---
title: "slang autodiff #9808 leaks compile-time onto non-autodiff modules via unconditional finalize passes"
type: learning
topic: slang-compiler
source: learnings/1780594441175-slang-autodiff-9808-leaks-compile-time-onto-non-au.md
---

# slang autodiff #9808 leaks compile-time onto non-autodiff modules via unconditional finalize passes

Investigating slang#11474 (MDL-bench compile-time regression +16–36% correlated with PR #9808 "Refactor auto-diff implementation", merged 2026-04-01). Two distinct root causes — don't conflate them:

**1. Unconditional whole-module autodiff finalization (best fit for precompilation:dxil +36%).** In `source/slang/slang-emit.cpp` `linkAndOptimizeIR`, `finalizeAutoDiffPass` (~:1286) and `lowerDiffTypeInfoInsts` (~:1295) run UNCONDITIONALLY, whereas `checkAutodiffPatterns` (~:1243) is correctly guarded by `if (requiredLoweringPassSet.autodiff)`. `finalizeAutoDiffPass` (slang-ir-autodiff.cpp:1101-1127) does 6 whole-module walks. So every codegen/precompilation — even of derivative-free modules — pays the autodiff cleanup cost. Almost certainly an unintended oversight from the overhaul. (Provenance caveat: an earlier note blamed commit `f6e4a0c51` — that is WRONG; `f6e4a0c51` is an unrelated SPIRV change. The unguarded lines predate this clone's shallow history (`--depth 50`, boundary `be7ab29f2`) and cannot be commit-blamed from this checkout. The CODE-STATE facts here are independently verified and stand.) Likely fix: gate both behind `requiredLoweringPassSet.autodiff`, BUT first verify that flag is set whenever any diff inst/decoration is present in the *linked* IR (incl. core-module-pulled decorations) — else gating leaves stale annotations for emit.

**2. Fixpoint amplification (best fit for mono closesthit +16% / anyhit +35%).** Demand-driven derivative synthesis (post-#9808) injects derivatives inside `specializeDynamicInsts` (slang-ir-specialize.cpp:1779), inside the whole-module specialization fixpoint `for(;;)` @1680; each injection sets iterChanged → another full outer iteration re-running 5 heavyweight whole-module passes (@1757-1761). Scales with derivative count → bad on autodiff-dense MDL. NOTE: derivative synthesis itself IS memoized (slang-ir-translate.cpp:39-53, per-module translation dict) so re-synthesis is NOT the cost — the cost is the extra outer iterations. This is delicate core-pass territory; profile iteration count before touching, coordinate with autodiff owner.

**General lesson:** for a compile-time regression "correlated with a big refactor PR", look for passes the refactor made UNCONDITIONAL/per-function that were previously gated — that overhead hits even unrelated modules and is the lowest-risk lever, separate from the intrinsic cost on the feature's own workload.

**Provenance lesson:** never trust `git blame`/`git show` for line origin inside a shallow clone — `git log --oneline | tail` to find the boundary first, or `git fetch --unshallow` before attributing a line to a commit. A regression's root cause is the verified code state, not the commit that happened to touch it.

**Env note:** for `gh`/GitHub auth in containers, see `CONSOLIDATED-github-auth-and-ops-in-agent-containers` (gh probes can false-negative; use org-scoped REST / raw token, not WebFetch).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780594441175-slang-autodiff-9808-leaks-compile-time-onto-non-au.md`_
