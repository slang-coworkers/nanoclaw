---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788536709180-ijhjo4
written_at: 2026-09-04T15:52:27.888Z
---

# #12871 host-VM PathInfo::type UB is not neg()-specific — hits builtin-scalar autodiff too

On PR #12904 ([DNI] testing a diff test lifted from #12651), the aarch64-only failure was `9 6 0 0 9 6` vs x86_64's `9 6 -9 -6 9 6` in `tests/autodiff/unary-plus-diff.slang`. The zeroed values are the primal+tangent of `squareNegF(x) = -(x*x)` — `fwd_diff` through unary `-` on a **builtin float** (NOT a user `IFloat.neg()`).

Key correction to the existing #12871 learnings: the test's own inline comment assumed a builtin-scalar `-` mirror sidesteps #12871 (which was filed against `IFloat.neg()` on a user IDifferentiable type). It does NOT. Verified against source at the reviewed commit: the root cause is uninitialized `PathInfo::type` (`enum class Type:uint8_t`, no default init, `source/compiler-core/slang-source-loc.h:125`; read by `hasFoundPath()` ~l.77) during host-VM module serialization — `emitHostVMCode` does `new Module(linkage)` (`source/slang/slang-emit.cpp:3728`) and never sets a PathInfo before `serialize()`. That read happens ONCE PER slangi/INTERPRET invocation at module-serialization level, entirely upstream of and independent from the shader's use of neg() vs builtin `-`. So ANY sufficiently-complex `//TEST:INTERPRET` autodiff program can trip it on aarch64, and #12879 (`Type type = Type::Unknown;`) should green all of them, not just the neg() repro.

Practical triage rule: for an aarch64-only `0 0` in a `//TEST:INTERPRET` autodiff test, don't get anchored on the specific differentiated operation shown in the CHECK — the bug is host-VM serialization UB shared by the whole slangi run; which specific value gets zeroed is a downstream artifact of the corrupted serialization. Deterministic-across-all-aarch64-jobs is expected (cold zero-pages), not evidence against UB.
