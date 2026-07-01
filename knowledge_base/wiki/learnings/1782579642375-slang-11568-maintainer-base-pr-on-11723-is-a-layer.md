---
title: "slang #11568: maintainer 'base PR on #11723' is a layer-mismatch — front-end feature, csyonghe design is the real path"
type: learning
topic: slang-compiler
source: learnings/1782579642375-slang-11568-maintainer-base-pr-on-11723-is-a-layer.md
---

# slang #11568: maintainer "base PR on #11723" is a layer-mismatch — front-end feature, csyonghe design is the real path

**Context:** 2026-06-27, maintainer jkwak-work asked nv-slang-bot to "make a PR for #11568 based on PR #11723" (which closed #11718). Verified at HEAD 1708afc8d this premise is mechanically N/A, and surfaced it (deferentially) in the triage verdict rather than silently porting nothing.

**Why #11723 is not a template for #11568 (different compiler layers, ~zero shared surface):**
- #11723 (closed #11718) = BACKEND only: `-spirv-unified-descriptor-heap-stride` flag. Files: slang-emit-spirv.cpp, slang-options.cpp, slang-diagnostics.lua, include/slang.h enum, docs, one tests/spirv test. No checker, no core-module.
- #11568 = FRONT-END feature: accept HLSL `Texture2D t = ResourceDescriptorHeap[i];` input syntax. Needs a new indexable builtin + implicit conversions + IR lowering. There is no diff to port from #11723.

**Front-end blocker (verified still present @ HEAD):** the natural `__subscript(uint) -> DescriptorHandle<T>` fails `E39999` — Slang infers a subscript's generic `T` from index args only; `OverloadResolveContext` has no expectedType field (slang-check-overload.cpp:3082, slang-check-expr.cpp:3600; inferGenericArguments unifies value args only). Return-position-only generics are uninferable (DeepWiki confirms).

**The real path = csyonghe's settled design** (his issue comment, just before jkwak's): add builtin `UntypedResourceHandle`/`UntypedSamplerHandle` with dedicated IR type opcodes; `ResourceDescriptorHeap[i]` returns the NON-generic untyped handle (sidesteps return-position inference); `__implicit_conversion` to resource types and to `.Handle`/`DescriptorHandle<T>`; reuse `kIROp_CastDescriptorHandleToResource`/`getDescriptorFromHandle` (no new emitters); conversion-to-handle lowers as `DescriptorHandle<T>(uint2(i,0))`; dangling `IRUntypedResourceHandle` → uint before emit. Scope ≈ MEDIUM.

**Implementation pointers (HEAD 1708afc8d):** DescriptorHandle decl hlsl.meta.slang:27428; IR opcode pattern slang-ir-insts.lua:365-370; cast op hlsl.meta.slang:27567-27568 + legalize slang-ir-legalize-types.cpp:2130-2131; implicit-conv pattern hlsl.meta.slang:27346 + cost lookup slang-check-conversion.cpp:326-334; HLSL emit slang-emit-hlsl.cpp:1328-1344.

**Lesson:** when a maintainer points at PR X as a "template" for issue Y, verify X's actual file surface before assuming transferability — a backend-enabler PR and a front-end-syntax feature can both be "about descriptor heaps" yet share no code. Surface the layering in the verdict; the draft PR is the redirect safety net.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782579642375-slang-11568-maintainer-base-pr-on-11723-is-a-layer.md`_
