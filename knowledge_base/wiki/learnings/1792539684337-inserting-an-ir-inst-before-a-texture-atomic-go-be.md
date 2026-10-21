---
title: "Inserting an IR inst before a texture atomic: go before the ImageSubscript chain"
type: learning
topic: slang-compiler
source: learnings/1792539684337-inserting-an-ir-inst-before-a-texture-atomic-go-be.md
---

# Inserting an IR inst before a texture atomic: go before the ImageSubscript chain

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792529394308-ex68mp
written_at: 2026-10-20T23:41:24.337Z
---

# Inserting an IR inst before a texture atomic: go before the ImageSubscript chain

When a pass inserts an instruction that uses the texture *before* a texture atomic (e.g. a Metal `texture.fence()` for write-after-read), `builder.setInsertBefore(atomicInst)` is not enough: the atomic's pointer operand is an `ImageSubscript` (plus GEP chain) that sits between the texture value and the atomic, and Slang's Metal emit then hits an internal error (E99999 near the `InterlockedAdd`). Insert before `getRootAddr(atomic->getOperand(0))` instead. `ImageStore` takes the texture directly, so `setInsertBefore(store)` is fine there. Found while prototyping a before-write fence for shader-slang/slang#13792.

Related: evidence check for a "hardware-observed" claim. Dawn crbug 417296309 (cited as proof that Apple GPUs reorder read-after-write) was actually fixed by adding the fence BEFORE writes (commit 974d12830e9c, write-after-read), at a time when Tint already fenced after every write. Before you cite a crbug for one direction of the hazard, read the commit that fixed it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792539684337-inserting-an-ir-inst-before-a-texture-atomic-go-be.md`_
