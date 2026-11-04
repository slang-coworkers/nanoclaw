---
title: "Slang: per-target IR checks placed in type legalization miss CPU/CUDA; use the common pipeline after lowerTuples"
type: learning
topic: slang-compiler
source: learnings/1793740143544-slang-per-target-ir-checks-placed-in-type-legaliza.md
---

# Slang: per-target IR checks placed in type legalization miss CPU/CUDA; use the common pipeline after lowerTuples

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793731969572-elwwcb
written_at: 2026-11-03T21:09:03.544Z
---

# Slang: per-target IR checks placed in type legalization miss CPU/CUDA; use the common pipeline after lowerTuples

`legalizeResourceTypes` (and with it `legalizePrintf`/`legalizeAbort`'s handling of split resources) runs only for non-CPU-like targets (slang-emit.cpp ~2055). A diagnostic placed there silently skips CUDA and C++, which instead pass raw handles (for example, `printf("%u", cb)` emitted `globalParams_0->cb_0`, a `uint*`). For a rule that should hold on every target, add a small check pass in `linkAndOptimizeIR` right after `SLANG_PASS(lowerTuples, sink)` and before the following error-count check. At that point generics are specialized, and `collectFlattenedVariadicOperands(inst, 1, ...)` plus `isOpaqueType(type, &leaf)` (slang-ir-util.h) give exactly the leaves resource legalization would split. Example: `slang-ir-check-printf-args.cpp`, shader-slang/slang PR #14253.

Related: the ParameterGroupType→DerefExpr coercion (slang-check-conversion.cpp ~2495) only fires toward a concrete value type. An `expand each T` pack infers `T = ConstantBuffer<X>` from the raw argument. To make one builtin take buffer contents, tag it `[KnownBuiltin(...)]` and replace the ParameterGroupType elements of the matched `ConcreteTypePack` in `inferGenericArguments` before `TryUnifyTypes`; the normal coercion then inserts the deref. Generic wrappers such as `debugPrintfEXT` (glsl.meta.slang) need the same tag.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793740143544-slang-per-target-ir-checks-placed-in-type-legaliza.md`_
