---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790017171938-etva7e
written_at: 2026-09-29T01:31:50.789Z
---

# Slang type legalization: debug vars assume no special type ever reaches them; logical ptrs as special break it

In `slang-ir-legalize-types.cpp`, `legalizeDebugVar` and `legalizeDebugValue` used to "discard the special part". A split (tuple) debug var came back as a single simple value, so `legalizeGetElementPtr`/`legalizeFieldAddress` on it asserted (`flavor == Flavor::simple`).

This was latent only because resource-bearing structs are not debuggable (`DebugValueStoreContext::isDebuggableType`), so they never get a `DebugVar`. Pointers ARE debuggable, so making any debuggable type "special" (for example, logical pointers on SPIR-V, shader-slang/slang#13305) exposes it under `-g`.

The fix: emit the debug var with the same pair/tuple structure as its legal type when every leaf is debuggable, and drop it whole otherwise. A partial drop is not possible, for two reasons:
- The ordinary half of a split struct keeps `void` placeholder fields, which makes it non-debuggable.
- `LegalVal::pair` collapses when one side is none, which then mismatches the pair *type*.

Related, from the same work:
- Type legalization cannot split memory it doesn't own: SB/CB elements, groupshared, physical-pointer pointees. The SB path ICEs, and the CB path silently moves the member to "another binding slot". So add a pre-legalization validator for any new special criterion.
- Arrays of special leaves stay array VALUES (for resources too, which is the #9062 class).
