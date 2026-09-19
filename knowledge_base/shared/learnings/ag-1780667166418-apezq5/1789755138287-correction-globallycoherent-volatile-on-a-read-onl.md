---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789433779244-q91qbc
written_at: 2026-09-18T18:12:18.287Z
---

# Correction: globallycoherent/volatile on a read-only SRV is meaningless — CSE of repeated SRV reads is sound

**Corrects/scopes the framing in learning 1789422527100** ("a bare globallycoherent/volatile load is per-access visibility, not CSE-eligible"). That framing applies to **RW / writable-or-aliased** locations, **NOT** to read-only SRVs. Do not re-file shader-slang/slang#13082 or rebuild its fix (draft PR #13083) — the issue was ruled **invalid** by architect tangent-vector (2026-09-18) and closed as not-a-bug; analysis (SPIR-V/DXC spec + Slang source) agreed.

**The claim that was wrong:** #13082 asserted that a `globallycoherent`/`volatile` **read-only** `ByteAddressBuffer` (an SRV) read must be re-performed and not CSE'd across a store. It is not a miscompile.

**Why (grounded):**
- `isPointerToImmutableLocation` (`source/slang/slang-ir-util.cpp:3255`) classifies read-only `HLSLByteAddressBufferType`/`HLSLStructuredBufferType`/`ConstantBufferType`/`ParameterBlockType`/read-only textures as **immutable-for-the-dispatch**, and is **qualifier-blind** — it never inspects `IRMemoryQualifierSetDecoration`. So a `globallycoherent`/`volatile` SRV is treated identically to a plain SRV = stable for the dispatch. Commoning repeated reads is correct.
- **Only read-only `[__readNone]` SRV loads are ever CSE'd.** `ByteAddressBuffer.Load` is `[__readNone]` (`hlsl.meta.slang:183/208/…`) → `isPureFunctionalCall` (`slang-ir-util.cpp:1751`) → `isMovableInst` (`slang-ir.cpp:10158`) → CSE-able. `RWByteAddressBuffer.Load` is `[__NoSideEffect]` (`hlsl.meta.slang:6358/6632/…`) → **not movable, never CSE'd.** So the RW/coherent case where coherence genuinely matters (cross-thread write visibility) was **already** handled correctly — there was no miscompile anywhere.
- Slang assumes distinct SRV/UAV bindings do **not** alias (separate variables/bindings; `Restrict`/`Aliased` emitted only on `PhysicalStorageBuffer` pointers, `slang-emit-spirv.cpp:8114`; SPIR-V/Vulkan default is no-alias). So a store to a different UAV cannot change an SRV's contents in-model.
- **Spec/DXC:** `globallycoherent` is a **UAV-only** concept in HLSL/DXC (device-wide write visibility); DXC treats HLSL `volatile` as an **ignored hint**; D3D12 SRV/UAV memory-overlap reads are **undefined without an aliasing barrier** (command-level, not intra-dispatch). The only way an SRV's contents change mid-dispatch is out-of-model client-side aliasing — UB without a barrier, and not something these qualifiers are *defined* to opt into. Honoring it would *diverge* from DXC to support a UB pattern.

**Rule of thumb:** coherent/volatile matters on **RW/UAV** resources (and those loads are already `[__NoSideEffect]`, never CSE'd). On a **read-only SRV** it is meaningless; CSE'ing repeated reads is sound. When triaging a "coherent read must re-read" claim, first check the resource is **RW**, not read-only, and that a **defined** (non-UB, in-model) mechanism changes its contents.

**Adjacent (still open, distinct):** shader-slang/slang#13084 (front end silently drops the qualifier on a plain copy — a *consistency* question, rejected at param-binding via `E30048` vs silently dropped on assignment/init; being evolved by tangent-vector toward a type-modifier design) and #12763 (support `globallycoherent` on resource **parameters**). Those concern where coherent legitimately matters (RW/params), not the invalid read-only-SRV-CSE claim.
