---
title: "Slang printf/abort variadic arguments: opaque handles in packs, split-resource legalization, and where an all-targets check runs"
type: concept
group: slang-grab-bag
tags: [slang, printf, abort, variadic-generics, expand-each, ConstantBuffer, ParameterGroupType, DerefExpr, inferGenericArguments, ConcreteTypePack, KnownBuiltin, debugPrintfEXT, lowerTuples, legalizeResourceTypes, legalizePrintf, legalizeAbort, LegalVal, pair, tuple, linkAndOptimizeIR, E55211, fix-sizing]
source_count: 4
---

# Slang `printf`/`abort` variadic arguments

`printf<each T>(NativeString, expand each T)` and `abort` take a variadic pack whose element types are inferred from the arguments as written. An opaque argument, such as a `ConstantBuffer<uint>` or a texture, therefore enters the pack as a handle, and the resource legalization that runs later splits it in ways that `legalizePrintf` handles only in part. The motivating case is shader-slang/slang#14247. Its full producer-side fix was closed by the maintainer as too large for a rarely used feature; the general fix-sizing rule is on [[wiki/concepts/slang-misc-pr-process-and-maintainer-workflow.md]]. Other split-type ("special") legalization is on [[wiki/concepts/slang-compiler-ir-type-legalization.md]].

## TL;DR

- **A variadic pack infers `T` from the argument type as written**, so `printf("%u", cb)` passes the `ConstantBuffer<uint>` handle: the ParameterGroupType to DerefExpr coercion fires only toward a concrete parameter type.
- **An all-resource pack argument legalizes to a `tuple`, which `legalizePrintf` does not handle** (ICE "Unknown legalized val flavor for printf operand"). Any whole resource argument (`Texture2D`, `StructuredBuffer`) hits the same ICE.
- **A mixed pack argument legalizes to a `pair`, and the `pair` case keeps only `ordinaryVal`**: `printf("%u %u %u", 7u, cb, 9u)` silently prints two values on HLSL/GLSL/Metal/SPIR-V. `abort` reports E55211 for the same shape.
- **Probe mixed arguments whenever a legalization consumer has a `pair` case that drops `specialVal`.**
- **`legalizeResourceTypes` does not run for CPU-like targets**, so a diagnostic placed in type legalization silently skips CUDA and C++, which pass the raw handle (`uint*`).
- **A rule that must hold on every target belongs in a check pass right after `lowerTuples` in `linkAndOptimizeIR`**, where generics are specialized and `collectFlattenedVariadicOperands` plus `isOpaqueType` give exactly the leaves resource legalization would split.
- **To make one builtin take buffer contents, tag it `[KnownBuiltin]` and rewrite the ParameterGroupType elements of the matched `ConcreteTypePack` before `TryUnifyTypes`**; generic wrappers such as `debugPrintfEXT` need the tag too.
- **Today's workaround is an explicit cast (`(uint)cb`).** The maintainer closed the full fix (PR #14253) as overkill and marked #14247 unplanned.

## How an opaque argument reaches `legalizePrintf` (#14247)

Consider `ConstantBuffer<uint> cb;` and `printf("%u", cb);`. The core declaration `printf<each T>(NativeString, expand each T)` (hlsl.meta.slang ~15265) infers `T` from the argument type as written, so `T = ConstantBuffer<uint>`. The ParameterGroupType to `DerefExpr` coercion (slang-check-conversion.cpp ~2495) that would normally read the buffer's contents fires only for a concrete parameter type, so it never runs here. `lowerTuples` then wraps the pack arguments in a `MakeStruct`. Resource legalization, which does not run on CUDA/C++, turns a struct whose fields are all resources into a `tuple` legalized value, and `legalizePrintf` (slang-ir-legalize-types.cpp ~823) has no `tuple` case, so the compile ICEs with "Unknown legalized val flavor for printf operand". A struct with both ordinary and resource fields becomes a `pair`, and the `pair` case keeps only `ordinaryVal`. So `printf("%u %u %u", 7u, cb, 9u)` silently emits `printf(fmt, 7U, 9U)` on HLSL, GLSL, Metal and SPIR-V, while CUDA and C++ print the `uint*`. Any whole resource argument (`Texture2D`, `StructuredBuffer`) hits the same ICE, and `abort` gives E55211 for the same shape. When a legalization consumer has a `pair` case that drops `specialVal`, probe it with mixed arguments [printf/abort variadic packs bypass ConstantBuffer implicit deref](../learnings/1793732031520-slang-printf-abort-variadic-packs-bypass-constantb.md).

## Where a fix can go

A diagnostic placed in type legalization does not cover every target. `legalizeResourceTypes`, and with it the split-resource handling of `legalizePrintf`/`legalizeAbort`, runs only for non-CPU-like targets (slang-emit.cpp ~2055). CUDA and C++ instead pass raw handles: `printf("%u", cb)` emitted `globalParams_0->cb_0`, a `uint*`. A rule that should hold on every target belongs in a small check pass in `linkAndOptimizeIR` right after `SLANG_PASS(lowerTuples, sink)` and before the following error-count check. At that point generics are specialized, and `collectFlattenedVariadicOperands(inst, 1, ...)` plus `isOpaqueType(type, &leaf)` (slang-ir-util.h) give exactly the leaves that resource legalization would split. PR #14253 used this shape (`slang-ir-check-printf-args.cpp`) [per-target IR checks placed in type legalization miss CPU/CUDA](../learnings/1793740143544-slang-per-target-ir-checks-placed-in-type-legaliza.md).

The producer-side alternative works in the front end. To make one builtin take buffer contents, tag it `[KnownBuiltin(...)]` and, in `inferGenericArguments`, replace the ParameterGroupType elements of the matched `ConcreteTypePack` before `TryUnifyTypes`; the normal coercion then inserts the deref. Generic wrappers such as `debugPrintfEXT` (glsl.meta.slang) need the same tag [same](../learnings/1793740143544-slang-per-target-ir-checks-placed-in-type-legaliza.md). The other front-end hooks are the pre-inference argument loop at slang-check-overload.cpp ~3501 and `maybeCheckKnownBuiltinInvocation` at slang-check-expr.cpp ~8375 [printf/abort variadic packs](../learnings/1793732031520-slang-printf-abort-variadic-packs-bypass-constantb.md).

## Outcome: the full fix was declined as overkill (PR #14253)

Triage rated #14247 P2 and offered three options: (A) a front-end fix that dereferences arguments before pack inference, (B) a small IR diagnostic like `legalizeAbort`'s E55211, and (C) a load inside `legalizePrintf`. It recommended A, the producer-layer fix. The issue text itself also offered a cheap branch: "or the compiler reports a normal diagnostic". The fixer built A as draft PR #14253, which grew through review rounds into an inference hook, a checker diagnostic, a new all-targets IR check pass and a `debugPrintfEXT` tag: 15 files, +334/-1, all six targets fixed, GPU-verified. About 20 minutes after it opened, jkwak-work (reporter, self-assignee and MEMBER) closed it unmerged: "This seems like an overkill for the rarely used functionality. An explicit casting should be used as a workaround until we have a better approach to the solution." They also marked the issue unplanned [maintainer closed a large frontend fix for a rarely used feature as overkill](../learnings/1793740425821-maintainer-closed-a-large-frontend-fix-for-a-rarel.md) [maintainers close large fixes for niche builtins as overkill](../learnings/1793740576539-slang-maintainers-close-large-fixes-for-niche-buil.md). So `(uint)cb` is the supported spelling today, and a future change here should start from option B, a normal diagnostic in place of the ICE.

**Source learnings (4):**
- [Slang printf/abort variadic packs bypass ConstantBuffer implicit deref; legalizePrintf ICEs on tuple and silently drops pair specials](../learnings/1793732031520-slang-printf-abort-variadic-packs-bypass-constantb.md) — pack inference as written; `tuple` ICE, `pair` drops `specialVal`; E55211 for `abort`; front-end hooks (#14247)
- [Slang: per-target IR checks placed in type legalization miss CPU/CUDA; use the common pipeline after lowerTuples](../learnings/1793740143544-slang-per-target-ir-checks-placed-in-type-legaliza.md) — `legalizeResourceTypes` skips CPU-like targets; check pass after `lowerTuples`; `[KnownBuiltin]` pack rewrite; `debugPrintfEXT`
- [Maintainer closed a large frontend fix for a rarely used feature as overkill (slang#14247)](../learnings/1793740425821-maintainer-closed-a-large-frontend-fix-for-a-rarel.md) — options A/B/C; PR #14253 15 files closed in ~20 min; scope signal, not a waiting period; stand-down shape
- [Slang maintainers close large fixes for niche builtins as overkill — size the fix to the feature's usage](../learnings/1793740576539-slang-maintainers-close-large-fixes-for-niche-buil.md) — the issue offered "a normal diagnostic"; scope-widening review findings are questions for the maintainer

_Catalog: [[wiki/index.md]]_
