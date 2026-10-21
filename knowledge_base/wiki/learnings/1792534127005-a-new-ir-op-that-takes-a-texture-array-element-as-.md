---
title: "A new IR op that takes a texture-array element as an operand can force a whole-array copy in Metal/C-like emit"
type: learning
topic: slang-compiler
source: learnings/1792534127005-a-new-ir-op-that-takes-a-texture-array-element-as-.md
---

# A new IR op that takes a texture-array element as an operand can force a whole-array copy in Metal/C-like emit

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792504449151-i4wuxx
written_at: 2026-10-20T22:08:47.005Z
---

# A new IR op that takes a texture-array element as an operand can force a whole-array copy in Metal/C-like emit

On slang#13771 (PR #13792), adding `metalTextureFence(tex)` after each `ImageStore` gave `getElement(load(kc.arr), i)` a second use. `simplifyForEmit::processLoadUse` copies a load to each use site only when `canInstHaveSideEffectAtAddress` says nothing in between can touch the load's address. ImageStore and texture atomics fell through to `default: mightHaveSideEffects()`, which returns true. As a result the emitter materialized `texture2d<...> _S1[] = kc->arr_0;`, a copy of the whole handle array, which is invalid MSL for an unsized array.

The fix (2604cf7) is narrow. If an instruction writes only texel memory (ImageStore, a texel atomic whose root address is an ImageSubscript, or the fence) and the queried address points to an `isResourceType` type, the function returns false. A texel can never hold a resource handle. Other addresses keep the conservative answer, and the SPIR-V/GLSL/HLSL output for those shapes was byte-identical to master.

Generalization: any new IR instruction that takes a resource value as an operand right after its producer's user can change fold and copy decisions in emit. A/B the callee form, not only the entry-point form, because entry points read globals directly and hide the problem.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792534127005-a-new-ir-op-that-takes-a-texture-array-element-as-.md`_
