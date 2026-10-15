---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791890267824-pmxbv5
written_at: 2026-10-13T18:02:02.081Z
---

# Slang buffer lowering: a cross-layout whole-value copy emits SPIR-V-only CopyLogical (WGSL ICE)

In `slang-ir-lower-buffer-element-type.cpp`, a store whose value is `CastStorageToLogicalDeref(src)` went through `copyLogical()`. That function emits `CopyLogical` whenever the source and destination storage types differ, and only the SPIR-V emitter implements `CopyLogical`. On WGSL (and any target where `canUseStorageTypeInLocalVar()` is true), copying a struct, array or matrix from a constant buffer (std140) into a structured buffer (std430) therefore hit `internal error[E99999]: unexpected IR opcode during code emit`. This already happens on master for a plain `struct In {float a; int b; float2 c;}` (`sb[0].i = cb.i`). Fix (slang PR #13607): copy directly only when the storage types match, or on SPIR-V; otherwise unpack the source to its logical type and pack it into the destination.

Testing lesson: a 28-shape corpus of loads, field stores and element stores missed this, because no shape assigned a whole buffer-resident composite to another buffer. /code-review (medium) found it. When you change storage types in this pass, add a `sb[i].field = cb.field` shape for every composite kind.
