---
type: triage
title: "shader-slang/slang#14268 — mixed Ptr ==/!= silently compares nullness via implicit Ptr→bool"
description: "Reproduced on master f1cd35ff8 (cuda, spirv-asm, L40S vk+cuda = 1 0 1 0 1 0 0 1). Ptr ==/!= overloads need identical Ptr<T,access,addrSpace,L>; any mismatch falls to bool==bool via bool.__init(Ptr) cost 400 (<500 warn threshold). Sibling of #14086. Parked for maintainer semantics decision."
tags: [pointer, overload-resolution, conversion, silent-miscompile, frontend, core-module]
---
# Triage: shader-slang/slang#14268 — Mixed Ptr equality/inequality silently compares nullness via implicit bool conversion
Date: 2026-11-03 | bug | high (silent wrong code) | P2 | frontend (core-module overload resolution) | Duplicate: no (sibling #14086)

## What's broken
`a == b` / `a != b` where `a`, `b` are `Ptr` with ANY differing generic arg (pointee T, Access, AddressSpace, layout L,
or `Ptr<void>`) compiles with no diagnostic and compares `bool(a) == bool(b)` (nullness), so two distinct non-null pointers
compare equal. Same-type pointers compare addresses (correct).

## Repro (verified on master f1cd35ff8, Release rebuilt 2026-11-03)
- `slangc repro.slang -entry compare_ptrs -target cuda -O3` → exit 0, `bool _S5 = _S1 != nullptr; ... uint(_S5 == _S6)`.
- `-target spirv-asm -O3` (SPIR-V validation on) → exit 0, `OpConvertPtrToU` + `OpINotEqual …0` + `OpLogicalEqual/NotEqual` (6×) vs `OpIEqual` for the same-type control.
- GPU (L40S, slang-test COMPARE_COMPUTE, addresses = buffer base and base+16): **vk `1 0 1 0 1 0 0 1`, cuda `1 0 1 0 1 0 0 1`** — identical to the report. Correct would be `0 1 0 1 0 1 0 1`.
- Extra probes (scratch: /workspace/agent/scratch-14268/):
  - Device vs GroupShared `p == g` → also `OpLogicalEqual` of nullness (AddressSpace mismatch covered by the bug too).
  - Ordering ops do NOT fall back (bool has no `<`): mixed T `a < b` → E30019 "type mismatch … explicit conversion possible";
    mixed Access `a >= c` → misleading E39999 "ambiguous call to '>='" listing int64/uint64/intptr/uintptr candidates.
  - The declared implicit `Ptr<T>`→`Ptr<void>` conversion (core.meta.slang:2251-2254, cost PtrToVoidPtr=150) does not fire
    even with a known target type: `Ptr<void> v = p;`, `take(p)` → E30019 (also on 2026.13.1). Side finding, separate bug.
  - Mixed enums `A.Y == B.Q` compare tag ints (not bool) → not the same bug.

## Codebase digest (master f1cd35ff8)
- `source/slang/core.meta.slang:1645-1657` — `ptrTypeParameterList = "T, Access access, AddressSpace addrSpace, L:IBufferDataLayout"`, `fullPtrType = Ptr<T, access, addrSpace, L>`.
- `core.meta.slang:1672-1694` — all six comparison ops: `__generic<$(ptrTypeParameterList)> __intrinsic_op(Eql|Neq|Less|…) bool operator X($(fullPtrType) p1, $(fullPtrType) p2);` — one shared param set (since #7848, 2025; L since #10058).
- `core.meta.slang:1697-1702` — `extension bool { __generic<…> __implicit_conversion($(kConversionCost_PtrToBool)) __intrinsic_op(CastPtrToBool) __init($(fullPtrType)); }` (#2342, 2022: "implicitly to bool" is intended).
- `slang-ast-support-types.h:144` PtrToBool=400; `:156` Default=500. `slang-check-conversion.cpp:2984` warning 30081 (unrecommended implicit conversion) only fires at cost ≥ 500 → silent.
- Bool `==`/`!=`: `slang-embedded-core-module-source.cpp:316-317` (ANY_MASK incl. bool) → concrete `bool operator==(bool,bool)`; `<` etc. use ARITHMETIC_MASK (no bool) → hence ordering errors instead.
- Generic inference (`TryJoinTypes`, `slang-check-constraint.cpp:302-334`) can't unify differing Access/AddressSpace and joins int/float only to a non-implicit Ptr conversion → Ptr candidate fails; bool candidate (800 total cost) is the only applicable one.
- Tie-break machinery that a heterogeneous overload would rely on: `CompareOverloadCandidates` `slang-check-overload.cpp:2284` (cost sum → … → `compareOverloadCandidateSpecificity` :2361 → `getOverloadRank` :2408); `[OverloadRank(-n)]` used in core.meta.slang (:951, :1769…).
- Bool-context hook if Ptr→bool became contextual: `checkPredicateExpr` `slang-check-stmt.cpp:293` (if/while/for/do); `!`, `&&`, `||`, `?:` separately.
- `static_assert(constexpr bool, NativeString)` exists in core (core.meta.slang:530; used with `T is float` in hlsl.meta.slang:1332).
- Tests: no test compares two Ptr values; only `p == nullptr` (tests/cpu-program/pointer-basics.slang:15, tests/spirv/pointer-default-constructor.slang, tests/metal/pointer-literals.slang), `if (ptr)` (tests/bugs/assign-nullptr.slang). Access-conversion rejection: tests/language-feature/pointer/pointer-casting/pointer-casting-rules.slang:26-33 (E30019 both directions).

## Candidate approaches
### A: Heterogeneous address-comparing `==`/`!=` overloads (core module only)
- Where: core.meta.slang:1688-1694 — add `__generic<T1, Access a1, AddressSpace s1, L1:IBufferDataLayout, T2, Access a2, AddressSpace s2, L2:IBufferDataLayout> bool operator==(Ptr<T1,a1,s1,L1>, Ptr<T2,a2,s2,L2>)` (+ `!=`), marked `[OverloadRank(-1)]` so the existing homogeneous overload still wins for same-type and `p == nullptr` (NullPtr can't infer T2). Body compares addresses (`uint64_t(p1) == uint64_t(p2)` / bitcast to `Ptr<void,…>`), never emits a raw C++ `uint* == float*` (ill-formed in CUDA C++).
- Must range over ALL four params incl. AddressSpace, or the uncovered shapes keep the silent bool fallback.
- Behaviour delta: mixed pairs compare addresses (zero-cost overload beats 400+400 bool path). Policy sub-choice: (A1) C-like — all same-address-space pairs compare; (A2) C++-like — allow Access mismatch and `void` on either side, reject unrelated T and differing AddressSpace with `static_assert(...)` in the body (error at specialization).
- Tradeoffs: local to core module; no checker special-case; `if (p)` / same-type / nullptr unchanged. A2's static_assert fires at IR/specialization time — fixer must confirm the diagnostic points at the user call site.
- Risk: new ambiguity with the homogeneous overload or NullPtr paths if the OverloadRank tie-break doesn't apply as expected; widens accepted language (A1).
### B: Diagnostic when `==`/`!=` resolves through Ptr→bool
- Where: slang-check-overload.cpp result of infix-op resolution / slang-check-conversion.cpp where `CastPtrToBool` implicit conversion is applied to an operator operand.
- Behaviour delta: mixed comparisons become an error (or warning) "comparing Ptr<X> and Ptr<Y> compares nullness; cast to a common pointer type or compare uint64_t(p)". No new semantics; consistent with `<` (already errors).
- Tradeoffs: consumer-side special case on one conversion (CLAUDE.md red flag), but tiny blast radius; shares a mechanism with #14086's proposed warning (explicit int cast via Ptr→bool).
- Risk: error vs warning is a maintainer call; erroring breaks any code that relied on the (wrong) behaviour.
### C: Make Ptr→bool contextual-only (C++ `explicit operator bool` model)
- Where: drop `__implicit_conversion` from core.meta.slang:1700; allow Ptr in `checkPredicateExpr` (slang-check-stmt.cpp:293) and `!`/`&&`/`||`/`?:`.
- Behaviour delta: mixed `==` errors naturally (no viable candidate); also fixes #14086 at the root (`int(p)` no longer chains through bool).
- Tradeoffs: principled root fix for the whole family; breaking for `bool b = p;`, `return p;` in bool funcs, Ptr→bool params (likely "pr: breaking change").
- Risk: largest blast radius; contradicts #2342's stated design ("implicitly to bool").
### Rejected: raise kConversionCost_PtrToBool to ≥500
- Only flips on warning 30081 for every implicit Ptr→bool incl. `if (p)` (checkPredicateExpr → coerce) — noise, still compiles the wrong comparison. The bool path is the ONLY candidate, so cost changes can't fix resolution (reporter says the same).

## Recommended path (uncertain — semantics need a maintainer decision)
- **Hypothesis (verified):** Ptr `==`/`!=` at core.meta.slang:1688-1694 need identical `Ptr<T,access,addrSpace,L>`; any mismatch leaves `bool==bool` via `bool.__init(Ptr)` (:1697-1702, cost 400 < 500 warn threshold) as the only candidate.
- **Recommended:** Approach A2 — one catch-all heterogeneous `==`/`!=` over all four params with `[OverloadRank(-1)]`: address compare for same AddressSpace when T matches modulo Access or either side is `void`; `static_assert` error for unrelated T or differing AddressSpace. Why: C++/CUDA semantics Slang's pointer syntax mirrors, core-module-only, keeps `if (p)`/`p == nullptr`/same-type unchanged, closes every shape.
- **Fallback if maintainers want no new semantics:** Approach B (error), coordinated with #14086. Approach C is the root option for both issues but breaking.
- **Suspected files:** source/slang/core.meta.slang:1672-1702; slang-check-overload.cpp:2284-2412 (tie-break, only if needed).
- **Repro:** `slangc /workspace/agent/scratch-14268/repro.slang -entry compare_ptrs -target cuda -O3` (+ `-target spirv-asm`); GPU: scratch gpu-repro.slang via slang-test (vk+cuda).
- **Acceptance:** gpu-repro prints `0 1 0 1 0 1 0 1` (or the chosen pairs error with a call-site diagnostic); same-type and `p == nullptr` codegen unchanged; Device-vs-GroupShared compare rejected; new tests under tests/language-feature/pointer/ (COMPARE_COMPUTE cpu/cuda/vk + DIAGNOSTIC_TEST); existing pointer tests pass.

## Sources
- DeepWiki Q1 (overload resolution + bool fallback): checker has no mechanism to forbid implicit conversions for operator args; ranking by conversionCostSum. (Its claim that 30081 would fire is wrong: 400 < 500.)
- DeepWiki Q2 (Ptr conversions/comparisons): comparisons take one full Ptr type; Ptr<T>→Ptr<void> declared implicit (but non-functional per probe); Access RW→Read rejected (E30019); user guide silent on mixed-type comparison.
- #14086 (OPEN, parked) — `(int)ptr` gives `ptr != nullptr` via the same Ptr→bool init; memo ../scratch/ptr-to-narrow-int-cast.md.
- PR #2342 (2022) introduced PtrToBool; PR #7848 (2025) made operators take `$(fullPtrType)` + added Access; PR #2400 PtrToVoidPtr; PR #10058 layout param L.
- #14059 / draft PR #14219 (TryJoinTypes Ptr/NullPtr join) — touches the same inference code; #13632, #12386 topic-adjacent only.
