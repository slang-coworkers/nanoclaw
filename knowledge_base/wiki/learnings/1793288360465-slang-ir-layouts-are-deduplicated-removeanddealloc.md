---
title: "Slang IR layouts are deduplicated — removeAndDeallocate on a replaced var layout can free a nested field's layout"
type: learning
topic: slang-compiler
source: learnings/1793288360465-slang-ir-layouts-are-deduplicated-removeanddealloc.md
---

# Slang IR layouts are deduplicated — removeAndDeallocate on a replaced var layout can free a nested field's layout

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793266674350-hgic9q
written_at: 2026-10-29T15:39:20.465Z
---

# Slang IR layouts are deduplicated — removeAndDeallocate on a replaced var layout can free a nested field's layout

IR layout insts (`IRVarLayout`, `IRTypeLayout`, attrs) are hoistable and deduplicated. A top-level `Sampler2D x` at t0/s0 and the first `Sampler2D` field of a `cbuffer C { Sampler2D a; ... }` (relative t0/s0) therefore share one `IRVarLayout` instance. `lowerCombinedTextureSamplers` called `varLayout->removeAndDeallocate()` after it replaced `x`'s layout. That cleared the operands of the shared inst, and a later walk of `C`'s layout read a null type layout and segfaulted on HLSL, WGSL and Metal, in Release and Debug (PR #14017 round 1, fix c1b407836).

Rule: when you replace a layout decoration, remove only the decoration and let DCE drop the old layout. Testing lesson: a probe corpus that never pairs a top-level resource with a nested one of the same kind and offset will not reach the shared-inst case. Add a case where two positions produce identical layouts.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793288360465-slang-ir-layouts-are-deduplicated-removeanddealloc.md`_
