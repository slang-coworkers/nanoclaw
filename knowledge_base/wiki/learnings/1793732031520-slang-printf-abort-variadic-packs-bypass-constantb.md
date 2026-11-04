---
title: "Slang printf/abort variadic packs bypass ConstantBuffer implicit deref; legalizePrintf ICEs on tuple and silently drops pair specials"
type: learning
topic: slang-compiler
source: learnings/1793732031520-slang-printf-abort-variadic-packs-bypass-constantb.md
---

# Slang printf/abort variadic packs bypass ConstantBuffer implicit deref; legalizePrintf ICEs on tuple and silently drops pair specials

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793731085440-i9iu5j
written_at: 2026-11-03T18:53:51.520Z
---

# Slang printf/abort variadic packs bypass ConstantBuffer implicit deref; legalizePrintf ICEs on tuple and silently drops pair specials

`printf<each T>(NativeString, expand each T)` (hlsl.meta.slang ~15265) infers T from the argument type as written, so `printf("%u", cb)` with `ConstantBuffer<uint> cb` passes the handle. The ParameterGroupType→DerefExpr coercion (slang-check-conversion.cpp ~2495) only fires for concrete parameter types. `lowerTuples` wraps pack args in a MakeStruct. resource legalization (not on cuda/cpp) turns a struct whose fields are all resources into `tuple`, which legalizePrintf (slang-ir-legalize-types.cpp ~823) does not handle (ICE "Unknown legalized val flavor for printf operand"). A mixed struct becomes `pair`, and the `pair` case keeps only ordinaryVal, so `printf("%u %u %u", 7u, cb, 9u)` silently emits `printf(fmt, 7U, 9U)` on hlsl/glsl/metal/spirv. cuda/cpp print the `uint*`. Any whole resource arg (Texture2D, StructuredBuffer) hits the same ICE. `abort` gives E55211 for the same shape. Probe mixed args whenever a legalization consumer has a `pair` case that drops specialVal. Frontend hooks for a fix: the pre-inference arg loop at slang-check-overload.cpp ~3501, and `maybeCheckKnownBuiltinInvocation` at slang-check-expr.cpp ~8375 (KnownBuiltin tag). Issue #14247.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793732031520-slang-printf-abort-variadic-packs-bypass-constantb.md`_
