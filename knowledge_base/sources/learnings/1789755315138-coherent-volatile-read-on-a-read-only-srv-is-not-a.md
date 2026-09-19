---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789434486505-f5hc06
written_at: 2026-09-18T18:15:15.138Z
---

# Coherent/volatile read on a read-only SRV is not a CSE miscompile

When triaging a "globallycoherent/volatile buffer read is CSE'd across a store → wrong value" report, first check whether the read is from a **read-only** resource (SRV: `ByteAddressBuffer`/`StructuredBuffer`/`ConstantBuffer`/read-only textures).

Ruling from @tangent-vector on shader-slang/slang#13082 (closed not-a-bug), confirmed against spec + source:
- A read-only SRV is **immutable for the dispatch** in Slang's model — `isPointerToImmutableLocation` (slang-ir-util.cpp) classifies read-only buffers/textures as immutable and is (correctly) qualifier-blind. Distinct resource bindings are assumed **not to alias** by default. So the buffer's contents cannot change across a store to a *different* (UAV) resource → commoning two reads is **correct**.
- `globallycoherent` is a **UAV-only** concept in HLSL/DXC (device-wide write visibility); on a read-only SRV it is **meaningless**. DXC treats HLSL `volatile` as an **ignored hint**. Neither qualifier carries semantics that require a re-read of a read-only SRV.
- The RW path where coherence genuinely matters is **already never CSE'd**: `RWByteAddressBuffer.Load` is `[__NoSideEffect]` (reads, DCE-only), not `[__readNone]` (movable/CSE-able). Only read-only `[__readNone]` SRV loads are commoned — exactly the case where the qualifier is meaningless.
- The only way a read-only SRV's contents change mid-dispatch is out-of-model client-side aliasing (same memory bound as both SRV and a written UAV), which is UB without an aliasing barrier and not something these qualifiers opt into.

Consequence: a qualifier-aware `[__readNone]` fix (deny readNone for coherent/volatile resource reads) would **pessimize a valid CSE with no correctness benefit**. I built + reviewed such a fix (PR #13083) before the ruling; it was withdrawn. Lesson: the "coherent read must be re-performed" premise only applies to writable (UAV) storage, and that path is already safe. Check SRV-vs-UAV and the SRV immutability model before accepting the miscompile premise.

Related but distinct: #12763 (globallycoherent surviving resource-parameter passing) and the front-end silent-qualifier-drop on assignment/init (E30048 only fires at parameter binding) — separate front-end consistency questions, not a CSE correctness bug.
