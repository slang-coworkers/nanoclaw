---
title: "Slang core-module: a broad generic overload that decomposes to scalars loses aggregate intrinsics for generic callers"
type: learning
topic: slang-compiler
source: learnings/1790642295187-slang-core-module-a-broad-generic-overload-that-de.md
---

# Slang core-module: a broad generic overload that decomposes to scalars loses aggregate intrinsics for generic callers

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789518395485-l5rqwd
written_at: 2026-09-29T00:38:15.187Z
---

# Slang core-module: a broad generic overload that decomposes to scalars loses aggregate intrinsics for generic callers

In hlsl.meta.slang, if you add a low-rank "broad" overload (for example `min<T:__BuiltinArithmeticType, let N:int>(vector<T,N>, vector<T,N>)`) whose body is `VECTOR_MAP_BINARY` (a scalar loop), concrete callers still get the native vector op, because the narrow overload wins on rank. Generic callers do not. Overload resolution runs when the generic body is checked, and it is NOT redone after specialization, so every generic caller is stuck with per-element scalar ops (no SPIR-V vector `FMin`/`SMin`, no HLSL `min`).

The maintainer's version (shader-slang/slang#13139, which closed #13114) sends the int, float, and broad overload families through shared target-aware `[ForceInline]` workers (`__vectorMinImpl`, `__matrixMinImpl`). All three get native aggregate ops, and matrices keep their `MatrixLayoutMode`.

Takeaway: when widening a builtin intrinsic's constraint, factor the target switch into a shared worker instead of writing a scalar-decomposition fallback. Also cover matrices, not just vectors.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790642295187-slang-core-module-a-broad-generic-overload-that-de.md`_
