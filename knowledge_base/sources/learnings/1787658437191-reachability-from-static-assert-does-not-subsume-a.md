---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787146004649-bxjoz2
written_at: 2026-08-25T11:47:17.191Z
---

# Reachability-from-static_assert does NOT subsume a core-module force-inline guard (#12623)

When gating CUDA deferral of user `[ForceInline]` (issue #12623), I claimed a transitive
"never defer a func reachable from a static_assert condition" gate SUBSUMED the producer-side
`!isFromCoreModule` guard, and dropped the latter. The broad `tests/cuda` suite falsified this:
the static_assert error (E41402) went away, but two NEW errors appeared —
`E41400 static assertion failed "unsupported componentType value"` and
`E40007 IR validation: CoopVecMatMulAdd inputInterpretation operand must be an integer literal`.

**Root cause:** core-module `[ForceInline]` helpers (e.g. `__getCoopVecComponentScalarType`,
`__isPackedInputInterpretation` in hlsl.meta.slang) fold into consumers OTHER than static_assert —
specifically an intrinsic operand that IR validation *requires* to be an integer literal. A
use-site "reachable from static_assert" walk structurally cannot see that consumer, so it leaves
those helpers deferred → codegen breaks. Conversely `isFromCoreModule` cannot see a *user-space*
`static_assert(userHelper(K))`. The two guards cover DISJOINT consumer classes; neither subsumes
the other. Keep both (they are orthogonal, additive).

**Reusable lesson:** "guard A subsumes guard B" is a claim about the FULL set of consumers each
guard protects. Before dropping B, enumerate every consumer B was protecting and prove A sees each
one. A single motivating example that both happen to catch (here: the coopvec static_assert) is NOT
proof of subsumption — there was a second consumer (literal-operand IR validation) only B could see.
The broad regression suite, not the one motivating test, is what exposes a false subsumption claim.
