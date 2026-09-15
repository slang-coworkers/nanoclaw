---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787805655972-gyqlgs
written_at: 2026-09-14T21:48:47.100Z
---

# A bare globallycoherent/volatile LOAD is per-access visibility, NOT an acquire fence — safe to CSE/reorder around (memory-model soundness rule)

Established on shader-slang/slang#12785 (cross-block CSE of read-only-resource-load calls) via codex + the SPIR-V/Vulkan memory model + the repo spec. Non-obvious and reusable for any pass that reasons about whether a memory-reading op's value is stable across intervening code (CSE, LICM/hoisting, redundant-load removal, reordering).

**Rule:** an intervening bare `globallycoherent` / `volatile` (HLSL) or `coherent`/`volatile` (GLSL) **load** does NOT establish a happens-before / acquire ordering over *subsequent unrelated* accesses, so it does NOT force a re-read of an unrelated (even aliased) location. Therefore it does NOT, by itself, block CSE/reuse/reordering of a separate read across it.

**Why (SPIR-V):** SPIR-V separates two distinct mechanisms:
- per-instruction **memory operands** (`MakePointerVisible | NonPrivatePointer` on an `OpLoad`) — a *visibility* op scoped to THAT reference/its own locations only; it makes that one load see up-to-date data.
- **memory semantics** (`Acquire`/`Release`) — carried by `OpMemoryBarrier` / `OpAtomic*`, which is what actually orders *other* accesses (a fence).
A coherent load only carries the former. Cross-invocation happens-before requires the latter (a real barrier or acquire-atomic), which is a **side-effecting** instruction — so a write/side-effect-focused between-walk gated on `IRInst::mightHaveSideEffects()` already catches it (barriers/atomics are side-effecting; a plain load is not, regardless of coherent/volatile qualifier).

**Evidence in-tree:** Slang's SPIR-V emit puts `NonPrivatePointer|MakePointerVisible` directly on the `OpLoad` with NO standalone `OpMemoryBarrier` (`source/slang/slang-emit-spirv.cpp:8890,8945`). Repo spec: happens-before is established only by release/acquire atomics or barriers (`docs/language-reference/basics-memory-model-consistency.md`). HLSL `globallycoherent` changes the *scope* of barriers, not making every load a device fence; GLSL orders via explicit `memoryBarrier()`.

**Corollary / the actual soundness gate for reusing a read across code:** (a) exclude reads whose *value* can change — for a call, gate on the callee provably reading only immutable read-only memory via `isPointerToImmutableLocation` (read-only SRV / ConstantBuffer / ParameterBlock / read-only texture; false-by-construction for RW / ROV / coherent-RW / a phi-merged handle whose type is RW), and (b) a write-focused between-walk (`mightHaveSideEffects`) to catch intervening stores/atomics/barriers — which honors "no assume-no-alias" because an aliased UAV write (SRV/UAV binding-alias per the spec) is a side-effecting store the walk catches. A bare coherent/volatile load in between is correctly NOT a blocker. Do NOT build a "cancel on any coherent/volatile access" gate — it's a non-convergent whack-a-mole (provenance can be obscured behind chains/loaded-handles/phis) AND over-conservative; the positive immutable-read gate + write-focused walk is the sound, convergent design.

Caveat: `volatile buffer` lowers to `GLSLShaderStorageBuffer` (mutable) → correctly not `isPointerToImmutableLocation` → excluded by the positive gate anyway.
