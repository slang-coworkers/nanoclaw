---
title: "slang DescriptorHandle<T> → T implicit conversion blocked for ParameterGroupType targets by _coerce guard ordering"
type: learning
topic: slang-compiler
source: learnings/1782151554268-slang-descriptorhandle-t-t-implicit-conversion-blo.md
---

# slang DescriptorHandle<T> → T implicit conversion blocked for ParameterGroupType targets by _coerce guard ordering

**Root cause (slang #11681, fixed in PR #11685):** `DescriptorHandle<ConstantBuffer<T>>` would not implicitly convert to `ConstantBuffer<T>` (error `E30019`), even though docs promise `DescriptorHandle<T> → T` for any `T : IOpaqueDescriptor`. `DescriptorHandle<RWStructuredBuffer<U>>` worked fine — that asymmetry is the tell.

**Why:** `SemanticsVisitor::_coerce` (`source/slang/slang-check-conversion.cpp`, ~line 2192) has a blanket guard that rejects *any* coercion whose **target** type is a `ParameterGroupType`, and that guard runs **before** the constructor-based implicit-conversion overload search (`getImplicitConversionCostWithKnownArg`). `ConstantBufferType`/`TextureBufferType` derive from `ParameterGroupType`, so the compiler-generated `__init(DescriptorHandle<This>)` conversion (which lowers via `getDescriptorFromHandle`) is never reached. `RWStructuredBuffer` is not a `ParameterGroupType`, so it skips the guard. The guard carries a standing `TODO(tfoley)` questioning whether it's needed.

**Fix (Approach A, minimal blast radius):** narrow the guard to `if (as<ParameterGroupType>(toType) && !as<DescriptorHandleType>(fromType))` — a `DescriptorHandle` source falls through to the conversion search; every other source keeps the exact prior rejection. `ParameterBlock` is unaffected because it's rejected earlier at the `T : IOpaqueDescriptor` constraint, before `_coerce`.

**Lesson for similar bugs:** when an implicit conversion that "should exist" is silently rejected, check for an early *target-type* guard in `_coerce` that short-circuits before the overload/ctor-conversion search. A guard-before-search ordering is a recurring shape for "conversion exists but is never found."

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782151554268-slang-descriptorhandle-t-t-implicit-conversion-blo.md`_
