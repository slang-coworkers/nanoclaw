---
title: "Slang flag-enum compound-assign gap: ILogical vs __BuiltinLogicalType operators"
type: learning
topic: slang-compiler
source: learnings/1781621242788-slang-flag-enum-compound-assign-gap-ilogical-vs-bu.md
---

# Slang flag-enum compound-assign gap: ILogical vs __BuiltinLogicalType operators

**Symptom (slang #11627):** On `[Flags]` enums, binary `|`/`&`/`^` compile but `|=`/`&=`/`^=` fail with `no overload for '|='`.

**Root cause (verified at core.meta.slang HEAD):**
- Enums conform to `ILogical` (`interface __EnumType : ILogical` — core.meta.slang:915).
- Binary bitwise ops `&|^~` are defined generically over `T : ILogical`, each `[OverloadRank(-10)]` — core.meta.slang:3615-3736. That's how enums get binary bitwise ops.
- Compound-assign ops are generated from the `kCompoundBinaryOps` table where `&|^` are constrained on **`__BuiltinLogicalType`** (not `ILogical`) — core.meta.slang:3248-3306. So no `operator|=/&=/^=` exists for `ILogical`/enum types.

**Two non-obvious facts:**
1. `a |= b` in Slang resolves by **overload lookup of an `operator OP=(in out T, T)` function**, NOT a checker-level desugar to `a = a OP b`. Confirmed by in-source comment at slang-check-expr.cpp:4100-4102 ("compound assignments ... desugar into function calls with `inout` parameters"). The function bodies happen to be `{ left = left OP right; return left; }` but the *function must exist* for resolution to succeed.
2. Builtin integer types conform to BOTH `__BuiltinLogicalType` and `ILogical`. The binary `ILogical` operators carry `[OverloadRank(-10)]` specifically so builtin-specific overloads win and `int | int` isn't ambiguous. Any new `ILogical`-constrained operator (e.g. a fix adding `ILogical operator|=`) MUST carry `[OverloadRank(-10)]` too, or `int |= int` becomes ambiguous.

**Fix direction:** add generic `operator|=/&=/^=` over `T : ILogical` near core.meta.slang:3710, scalar form, `[OverloadRank(-10)]` + `[__unsafeForceInlineEarly]`, mirroring the `__BuiltinLogicalType` block. Fixes enums + all `ILogical` user types at once. Regression test: tests/language-feature/enums/enum-bit-ops.slang (CPU COMPARE_COMPUTE, no GPU).

**General lesson:** when a binary operator works on a type-class but its compound-assign form doesn't, check whether the two operator families are authored against the *same* interface constraint in core.meta.slang. They diverge: binary bitwise → `ILogical`; compound-assign bitwise → `__BuiltinLogicalType`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781621242788-slang-flag-enum-compound-assign-gap-ilogical-vs-bu.md`_
