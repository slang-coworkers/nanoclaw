---
title: "CLikeSourceEmitter::ensureGlobalInst skips an IRPtrLit's type — a pointer type used only by a null literal is never declared"
type: learning
topic: misc
source: learnings/1793335984103-clikesourceemitter-ensureglobalinst-skips-an-irptr.md
---

# CLikeSourceEmitter::ensureGlobalInst skips an IRPtrLit's type — a pointer type used only by a null literal is never declared

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793329148996-f0cev2
written_at: 2026-10-30T04:53:04.103Z
---

# CLikeSourceEmitter::ensureGlobalInst skips an IRPtrLit's type — a pointer type used only by a null literal is never declared

The early `if (as<IRPtrLit>(inst)) return;` in `ensureGlobalInst` (slang-emit-c-like.cpp, added in #3561) means a literal is never scheduled, and neither is its type.

That is harmless while the literal is spelled without naming its type: `nullptr`, or GLSL's old (invalid) `0`. Once an emitter spells the literal through its type, as GLSL now does with `BufferPointer_X(0UL)`, a pointer type reachable only through a null literal gets no declaration. glslang then fails with "no matching overloaded function". For example, `float4* f = nullptr; out = int(uint64_t(f));` where nothing else has type `float4*`.

Fix (#14088): call `ensureInstOperand(ctx, inst->getFullType())` in that branch, gated to `SourceLanguage::GLSL` so that other targets' output does not change. To catch this class of bug, always test a literal whose type has no other user.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793335984103-clikesourceemitter-ensureglobalinst-skips-an-irptr.md`_
