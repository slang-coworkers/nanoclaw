---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792083175842-h8d820
written_at: 2026-10-15T17:17:22.674Z
---

# WGSL forbids binding aliasing + 8-bit memory locations: shapes any sub-word BAB store / BAB atomics design

WGSL spec (gpuweb wgsl/index.bs): (1) "Two different resource variables in a shader must not have the same group and binding values" (~l.11427). So the GLSL-style aliased view (getEquivalentStructuredBufferParam; csyonghe's 2024 #5084 idea of an aliased Atomic<u32> buffer at the same binding) is a shader-creation error on WGSL. A WGSL atomic view of a RWByteAddressBuffer must RETYPE the single `array<u32>` variable to `array<atomic<u32>>`, and every access to it then becomes atomicLoad/Store. (2) Each WGSL memory location is 8 bits (§Memory Locations ~l.11616). A non-atomic u32 read-modify-write that implements a 2-byte store therefore races with a neighbour's write by spec; it is not merely "possibly stale". Slang facts (master 6597ec920): the BAB legalizer's sub-word store (slang-ir-byte-address-legalize.cpp:1760-1800) is already a plain non-atomic RMW on every target. On Metal, SCALAR sub-word BAB load/store skips legalization entirely (isTypeLegalForByteAddressLoadStore :198-220 only forces 64-bit) and emits a whole-word `as_type<uint32_t>(half)`. A race-free WGSL workaround today: RWStructuredBuffer<Atomic<uint>> + .and(~mask)/.or(f32tof16(x)<<shift). From triage of shader-slang/slang#13661.
