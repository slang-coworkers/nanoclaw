---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787351755313-z0n93t
written_at: 2026-08-22T00:53:06.220Z
---

# Slang overload split by constraint only disambiguates when the type param is INFERABLE

When you give a Slang free function two overloads that differ ONLY in a generic type parameter's interface bound (e.g. jkwak's #12411 request: `coopVecLoad<N,T:__BuiltinArithmeticType>` + `coopVecLoad<N,T:ICoopElement>`), whether that is ambiguous depends entirely on whether T is INFERRED from an argument or specified EXPLICITLY:

- **T inferable from an argument** (e.g. `StructuredBuffer<T,L> buffer` — T is bound by the arg type): argument-based overload resolution disambiguates; the more-constrained overload wins for arithmetic T, the wider one still admits BFloat16. Two overloads compile & resolve cleanly (EXIT=0). Verified with base debug slangc.
- **T specified explicitly + NOT inferable from any argument** (e.g. `coopVecLoad<4, half>(byteAddressBuffer)` — the ByteAddressBuffer/RWByteAddressBuffer/`T*` pointer/groupshared `T[M]` forms don't carry T in a rankable position): the two candidates are indistinguishable and the call is **E39999 ambiguous** for a type that satisfies BOTH bounds (like `half`). This REGRESSES existing arithmetic-type callers. Verified: `h<4,half>(input)` with two constraint-only-differing overloads → `E39999 ambiguous ... candidate: h<4,half>(...) / candidate: h<4,half>(...)`.

Root cause: Slang does NOT rank overloads by constraint specificity — `slang-check-overload.cpp:2201` explicitly does not implement constraint-specificity comparison (per codex reading the source). So ranking only happens through ARGUMENT matching. `[OverloadRank(n)]` can force a winner where needed.

Consequence for #12411: the `coopVecLoad` "two overloads" split is feasible for the StructuredBuffer/RWStructuredBuffer forms but INFEASIBLE (ambiguity-regressing) for the ByteAddressBuffer/RWByteAddressBuffer/pointer/groupshared forms. For those, the correct move is a SINGLE widened `T:ICoopElement` overload (verified: one ICoopElement overload serves both `half` and `BFloat16`, EXIT=0), OR add `[OverloadRank]` to force selection. This conflicts with a byte-exact maintainer instruction → bounce back rather than silently pick one.

General rule: before splitting an API into constraint-differing overloads, check whether the discriminating type param appears in a matchable argument position. If it's explicit-only, the split is ambiguous — widen a single overload or use [OverloadRank] instead.
