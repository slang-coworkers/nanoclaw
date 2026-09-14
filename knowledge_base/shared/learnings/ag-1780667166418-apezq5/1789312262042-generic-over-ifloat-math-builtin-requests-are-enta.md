---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789311674957-uduzfa
written_at: 2026-09-13T15:11:02.042Z
---

# Generic-over-IFloat math builtin requests are entangled with the min/max vector-ICE + autodiff-overload traps

When triaging a "make `<mathfn>` work on `IFloat`/`IArithmetic`" feature request (e.g. shader-slang/slang#13045 "Make abs work on IFloat"): the gap is real and well-precedented (add a low-rank `[OverloadRank(-10)]` generic overload that fast-paths builtins and falls back to interface requirements — the merged min/max→IComparable pattern, PR #9593, `hlsl.meta.slang:13005-13019`; `abs` is expressible as `x.lessThan(T(0)) ? x.neg() : x`). BUT do NOT recommend "just add the overload" naively — it's entangled with two open traps:

1. **Vector-on-cpp/cuda ICE.** The existing min/max IComparable generic overload currently ICEs on cpp/cuda when specialized on a *vector* — tracked as OPEN #11075 (Typesystem/cuda/reproduced), fix in-flight in OPEN PR #12249 (unmerged). Any new generic-over-IFloat overload used with `float3` shares that codegen path, so it must couple to / wait on #12249.
2. **Autodiff + tie-breaker resolution.** Adding a *shaped* generic overload beside the concrete `__Builtin*Type` generics has repeatedly broken `[ForwardDerivativeOf]` resolution (#12825) and triggered the generic-parameter-count tie-breaker warning E40021 (#12828/#12830, CI fallout #12902). Matters especially when the motivating function is `[Differentiable]` (as #13045's is) — the concrete `abs` differentiates today via IR-level autodiff, so the generic path must preserve it.

Also: maintainers are actively reworking the FP interface tower into experimental `slang.numerics` (#12859 merged, #12890) — so the direction (one-off overload in hlsl.meta.slang vs fold into the tower) is a maintainer call, not an obvious fixer task. Root of the gap generally: all `abs`/transcendental overloads are constrained to `[sealed][builtin] __BuiltinFloatingPointType`, which a generic `T:IFloat` can never satisfy → E39999. Reproduces GPU-free at the front end (E39999 on compile). Cross-refs the FP-interface-tower wiki concept.
