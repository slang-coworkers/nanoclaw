---
type: triage
title: "Triage: shader-slang/slang#14401 — Cannot bit shift on generic integer types"
description: Core module has generic ILogical operators for & | ^ ~ ! && || &= |= ^= but none for << >> <<= >>=; recommended fix adds four rank -10 generic overloads that forward to shl/shr.
---
# Triage: shader-slang/slang#14401 — Cannot bit shift on generic integer types
Date: 2026-11-08 | bug | low | P2 | frontend (core module, `core.meta.slang`) | Duplicate: no

## What's broken / being requested
`uint TestFunc<T:ILogical>(T first, uint second) { return first >> second; }` gives
`E39999 no overload for '>>' applicable to arguments of type (T, uint)`. Reporter: JasperKr (external,
author_association NONE), Slang 2026.21. Reproduced on master ae4e57957 (Release slangc built after HEAD).

## Repro matrix (master ae4e57957, `slangc x.slang -no-codegen`)
| Case | Result |
|---|---|
| `T:ILogical`, `a >> uint` (repro) | E39999 (T, uint) |
| `T:ILogical`, `a >> T` / `a << T` | E39999 (T, T) |
| `T:IInteger`, `a >> uint` / `a >> T` | E39999 — same gap |
| `T:ILogical`, `x >>= int` | E39999 `>>=` |
| `T:ILogical`, `a & b`, `x &= b` | compiles (generic overloads exist) |
| `T:ILogical`, `a.shr(int(b))` returning `T` | compiles — workaround today |
| `T:IInteger`, `a.shr(int(b)).toUInt()` returning `uint` | compiles — workaround for uint return |
| `uint f<T:ILogical>(T a, T b) { return a & b; }` | E30019 type mismatch — reporter-side error |
| `enum E; e << 1` | E39999 (E, int) — same gap (enums are ILogical via `__EnumType`) |

**Reporter-side part:** the `uint` return type. Even after the core fix, `first >> second` has type `T`,
and `T` does not convert implicitly to `uint`. `ILogical` has no `toUInt()`. With `T : IInteger`, the user can write `.toUInt()`;
otherwise return `T`.
**Core-module gap:** there is no generic `<<`, `>>`, `<<=` or `>>=` for `ILogical`. Both `IInteger` and enums inherit the gap.

## Codebase digest (verified by reading source)
- `source/slang/core.meta.slang:214-254` — `ILogical` requires `This shl(int)` / `This shr(int)` (scalar `int` amount), plus bitAnd/bitOr/...
- `core.meta.slang:3846-3980` — generic `__generic<T:ILogical> [__unsafeForceInlineEarly] [OverloadRank(-10)]` `& && | || ^ ~ ! &= |= ^=`. No shift ops anywhere in `source/slang/*.meta.slang`.
- `core.meta.slang:3324-3409` — `kShiftOps` loop: concrete `<<`/`>>`/`__shl`/`__shr` + `<<=`/`>>=` are all `__generic<L:__BuiltinIntegerType, R:__BuiltinIntegerType>` intrinsics (scalar/vec/mat combos, rank 0). Any integer amount type.
- Conformers of ILogical: bool (`:1296`, shl via int cast), integer scalars (`:1340`, intrinsic Lsh/Rsh), `vector<T:__BuiltinIntegerType,N> : IInteger` (`:2401-2402`, uniform scalar-int shift), enums via `__EnumType : ILogical` (`:982`; witnesses synthesized at `slang-check-decl.cpp:9168-9175`, `:9402-9407`). Not: integer matrices, `vector<bool,N>`, floats.
- Vector `toInt()` returns `this[0]` (`core.meta.slang:2442`) — so `a >> b.toInt()` for `T=int3` shifts every lane by lane 0 (confirmed in HLSL output `a_0 >> (b_0[int(0)])`). Do NOT implement `T >> T` via `toInt()`.
- `slang-check-overload.cpp:2380-2413` — the scope rank is compared before the OverloadRank, and both are skipped for Generic/UnspecializedGeneric flavors. A user-file prototype is therefore not fully representative of core-module placement.
- History: #2389 (1f3130055, 2022) added ILogical + generic `& | ^ ~` without shifts. #3317, #3874, #4056 and #11729 added more generic ops, still without shifts. Nothing shows the omission was deliberate.
- Precedent: `source/standard-modules/numerics/wrappers.slang:320-443` has generic `<<`/`>>`/`<<=`/`>>=` (rank -4) over `IIntegerType` with `T.ShiftAmount`.

## Candidate approaches
### Approach A: generic shift wrappers, scalar amount of any builtin integer type (RECOMMENDED)
- Where: `core.meta.slang`, after `^=` (~:3980).
- Shape: `__generic<T : ILogical, U : __BuiltinIntegerType> [__unsafeForceInlineEarly] [OverloadRank(-10)] T operator <<(T v0, U v1) { return v0.shl(__intCast<int>(v1)); }`, the same for `>>`, and `in out` versions of `<<=`/`>>=` like the existing `&=`.
- Behaviour delta: `T op uint/int/...` works for any ILogical T, including IInteger, int vectors and enums. The repro binds at 0 conversion cost.
- Tradeoffs: matches the existing `shl(int)` requirement, so there is no interface change. The amount is narrowed to `int`, which is fine for shift counts. `T >> T` stays unsupported (see C).
- Risk: **`bool << n`**. Today the concrete path promotes bool to int (`int(b) << 1`, result `int`). A generic `T=bool` binding costs 0 and beats the concrete path's BoolToInt conversion, so the result would silently become `bool`. The fixer must preserve the int result, for example with a concrete bool overload or a narrower constraint, and must add a test. Concrete `int >> uint` and `int3 >> uint` must still pick the rank-0 intrinsics. A user-level prototype confirmed this in HLSL output (`i_0 >> 2U`, no wrapper cast), but in-core placement must be re-verified.
### Approach B: fixed `int` amount only (`T operator>>(T, int)`)
- Behaviour delta: smaller overload set. `T >> uint` needs an implicit uint→int conversion, so the overload still applies, but with a conversion cost.
- Tradeoffs: simpler. The bool risk is the same (`b << 1` with an int literal binds at cost 0). The conversion warnings and costs could interact with the rank-0 concretes in mixed-sign cases.
- Risk: slightly more overload-resolution surprise than A, and no real benefit.
### Approach C: also support per-lane `T >> T` (new interface requirement)
- Add a requirement such as `This shr(This amount)` to ILogical, or adopt the numerics `ShiftAmount` associated type.
- Tradeoffs: an interface change affects every conformer, including enum witness synthesis and user conformances. It is a design question for maintainers, and `slang.numerics` `IIntegerType` already covers it.
- Risk: high blast radius. Not needed for the reported case.

## Recommended path (solution brief)
- **Hypothesis:** `core.meta.slang` lacks generic `ILogical` shift operators. Concrete shifts require `L,R:__BuiltinIntegerType`, so a generic `T` matches nothing.
- **Files:** `source/slang/core.meta.slang:3846-3980` (add after `^=`), `docs/user-guide/06-interfaces-generics.md:1405-1412`, and a new test `tests/language-feature/generics/ilogical-shift-ops.slang`.
- **Repro:** `printf 'T f<T:ILogical>(T a, uint b){return a >> b;}\n' > r.slang && ./build/Release/bin/slangc r.slang -no-codegen`
- **Recommended:** Approach A, with four rank -10 generics `T op(T, U:__BuiltinIntegerType)` forwarding to `shl`/`shr(__intCast<int>(amt))`. It mirrors the existing `&`/`&=` block and needs no interface change.
- **Acceptance criteria:**
  1. `<<`, `>>`, `<<=` and `>>=` compile and run correctly for `T:ILogical` and `T:IInteger`, with T = int, uint, int64, an int vector (scalar amount) and an enum. The test is a COMPARE_COMPUTE on CPU plus GPU (vk/cuda available).
  2. Concrete shifts keep binding the intrinsics, unchanged: `int>>uint`, `uint3>>uint`, `int3>>int3`, `int64<<int16`, `x<<=u`.
  3. `bool << 1` still yields `int`, and a test locks this in.
  4. `T >> T` is still diagnosed (or explicitly scoped out).
  5. The docs paragraph says shifts take a scalar integer amount and fixes the three stale claims: integer matrices do not implement ILogical, IInteger includes integer vectors, and `IFloat` is `IArithmetic, IDifferentiable` with no `ILogical` (`core.meta.slang:340`).
- **Judgment call:** the docs fix is folded into this chain rather than filed separately, because it is the same paragraph the fix must edit anyway.

## Sources
- DeepWiki: the generic-operator layout for IArithmetic/ILogical (it confirmed there is no forwarding shift). The OverloadRank answer was partly wrong: it assumed int is not ILogical. Overload ordering was verified in source instead.
- Shared learnings: ILogical compound-assign gap (`/workspace/shared/wiki/learnings/1781621242788-...`) and the generics overload-inference concept (generic-vs-generic skips OverloadRank).
- Related, not duplicates: #12591 (verbose generics), #12859 (numerics module, generic shifts there), #12249 (fix template: hidden generic overloads for IFloat/IInteger), #11648, #11729.
