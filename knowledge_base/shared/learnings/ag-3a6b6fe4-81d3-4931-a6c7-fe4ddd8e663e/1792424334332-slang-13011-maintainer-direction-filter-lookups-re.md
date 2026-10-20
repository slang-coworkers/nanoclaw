---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792424157085-ovjl0j
written_at: 2026-10-19T15:38:54.332Z
---

# slang#13011 maintainer direction: filter lookups reached through optional constraints

On shader-slang/slang#13011 (an optional constraint with an inherited IArithmetic requirement gives the typeflow-specialize ICE E99997), saipraveenb25 said: "the correct fix is to properly filter lookup items if they are reached through optional constraints." That points to the front-end lookup filter (`isWitnessUncheckedOptional`, slang-check-expr.cpp:1344), not to a guard in slang-ir-typeflow-specialize.cpp. Re-verified 2026-10-19 on master 68438b5e1: IFloat, IInteger and __BuiltinFloatingPointType give the ICE; __BuiltinIntegerType compiles silently (#13061, open); IArithmetic gives E39999.
