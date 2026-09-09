---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786994175182-tmuvdz
written_at: 2026-08-17T19:33:32.826Z
---

# Slang transcendental math (pow/exp/log) is on __BuiltinFloatingPointType (scalar-only interface), NOT IFloat

Issue #12591 (2026-08-17, master a0690fa7d). A user wanted one generic `pow` for both scalar and vector float and hit three walls. Mechanism, verified at source + empirically (fresh Release slangc):

- `T: __BuiltinFloatingPointType` is `[sealed]` and implemented ONLY by float/half/double SCALARS (core.meta.slang:922). A `vector<float,N>` deliberately does NOT conform → `error[E38029] type argument 'vector<float,3>' does not conform ... '__BuiltinFloatingPointType'`.
- `T: IFloat` fails on `pow` with `error[E39999] no overload for 'pow'`. Every transcendental intrinsic (pow/exp/log/sqrt/sin/cos...) is declared `__generic<T:__BuiltinFloatingPointType>` plus explicit vector<T,N>/matrix overloads (also on __BuiltinFloatingPointType). Count: **0** transcendental decls constrained to IFloat vs **268** __BuiltinFloatingPointType usages in hlsl.meta.slang. IFloat (core.meta.slang:304) exposes only add/sub/mul/div/mod/neg/scale/toFloat + __init(float) — no element access, no transcendental.

Two nuances that kill plausible-but-wrong framings:
- `vector<T,N>` DOES conform to IFloat (arithmetic works), and `T(2.4)` under IFloat does NOT floor (emits float_2_4000001) — so the #12311 IArithmetic-`__init(float)`-flooring bug is IRRELEVANT here. The ONLY IFloat-path defect is pow's absence.
- ⛔ DeepWiki asserts "pow has IFloat overloads" and gives a `genericPow<T:IFloat>` example — that is FALSE; that example is exactly the E39999 case. Verify constraint targets at source, not DeepWiki.

Doc defect: `__BuiltinFloatingPointType`'s doc comment (core.meta.slang:915-917) says "use IFloat instead" for scalar+vector generics — true for basic arithmetic, misleading for transcendentals.

Unblock today (less verbose than explicit vector<T,N> everywhere): two same-named overloads (scalar `T:__BuiltinFloatingPointType` + `vector<T,N>`), let overload resolution pick.

Dedup: overlaps umbrella #6138 (Feature) and sibling #6961 (Bug, exp on __BuiltinFloatingPointType — note its DIRECT scalar case now WORKS at HEAD, was E30019 in Apr 2026). Adding IFloat-transcendental is a stdlib/language design call (IFloat has no element access to implement element-wise math on the abstract interface).
