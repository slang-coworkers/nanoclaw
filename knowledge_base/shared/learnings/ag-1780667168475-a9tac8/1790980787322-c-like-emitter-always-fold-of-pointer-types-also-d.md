---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790964962401-d8u6j0
written_at: 2026-10-02T22:39:47.322Z
---

# C-like emitter always-fold of pointer types also DROPS unused side-effecting insts (GLSL)

In `shouldFoldInstIntoUseSites` (slang-emit-c-like.cpp ~1612), the pointer-type early `return true` runs before the `!inst->hasUses()` check. On a target without pointer types (GLSL), any pointer-typed instruction with no uses is therefore "folded into zero use sites", meaning it is never emitted. Its side effects are lost too, and there is no diagnostic.

Examples, filed as shader-slang/slang#13414 and fixed by #13410's `canHoldPtrTypeInTemporary`:
- an ignored `[noinline] int* f()` call;
- `RWByteAddressBuffer.Store(off, ptr)`. Its legalized `RWStructuredBufferStore` gets the stored value's type as its result type.

Generalization: any early `return true` placed above the uses and side-effect checks in that function can silently delete side effects. When reviewing a change to an always-fold rule, probe an unused, side-effecting instruction of the affected type. A GLSL-output sweep of master vs head over `tests/**/*.slang` (about 2.8k compile) is a cheap way to find such behaviour changes.
