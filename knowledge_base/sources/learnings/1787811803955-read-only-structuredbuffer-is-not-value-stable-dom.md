---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787806318372-k65yzu
written_at: 2026-08-27T06:23:23.955Z
---

# Read-only StructuredBuffer is NOT value-stable: dominance alone can't CSE loads/calls across writes (slang#12785)

When adding CSE for calls/loads that read a read-only `StructuredBuffer` (SRV), **dominance + structural equality is NOT sufficient** — you also need an intervening-aliased-write guard.

**Why:** Slang's aliasing model (verified via DeepWiki + `canAddressesPotentiallyAlias` + the explicit comment at `slang-ir-transform-params-to-constref.cpp:203-206`: *"we should in general not assume a read-only StructuredBuffer... as an immutable location due to potential aliasing"*) says a `StructuredBuffer` can be aliased by a `RWStructuredBuffer` bound to the same memory. A write through the UAV is visible to a later SRV read. **Empirical proof:** `slangc` does NOT CSE two identical *direct* `StructuredBuffer` loads across an intervening UAV store (the two `__ldg` loads stay distinct). This is exactly why `kIROp_StructuredBufferLoad` is deliberately absent from `isMovableInst`.

So the reporter's framing (issue #12785) that dominance-preserving CSE of a read-only-resource-load call is "safe" is INCOMPLETE: it's only safe if no aliasing write occurs between the dominating and dominated call. A `readNone` (no reads at all) call is always safe; a `readOnlyAccess` (reads immutable-through-this-handle memory) call is NOT, because "immutable through this handle" ≠ "immutable in memory."

**How to apply:** Any new "read-only access" effect tier feeding `removeRedundancy`'s `DeduplicateContext` (which only checks dominance + `IRInstKey` equality, NO memory-dependence analysis) will miscompile the aliased-write case. The sound fix needs a kill/available-expressions analysis (invalidate the CSE candidate when a side-effecting store/atomic/aliasing-call appears between the two calls), or a maintainer-gated assume-no-aliasing mode. Two more traps found the same task: (1) byte-address legalization (`slang-ir-byte-address-legalize.cpp:884`) emits `kIROp_StructuredBufferLoad` from a *mutable* `RWByteAddressBuffer`, so opcode-only SRV classification is unsafe — must also check `isPointerToImmutableLocation` on the buffer operand; (2) `slang-ir-specialize-function-call.cpp:1094-1101` strips `ReadNone`/`NoSideEffect` after specialization ("substituted param may be a global param") — any new effect decoration must be stripped there too or it goes stale.
