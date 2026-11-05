---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793813801787-lwd86m
written_at: 2026-11-04T17:57:37.187Z
---

# D3D StructuredBuffer reflection never rounds nested struct size; DXC does (slang#14311)

Verified on master 3da6f63c0e. For `struct Inner{uint64_t key; uint value;}; struct Outer{Inner item; uint tail;}`, D3D (hlsl/dxil) StructuredBuffer reflection reports Inner size 12, `tail`@12, Outer size 16 (stride 16). DXC lays it out as tail@16, size 24 (see the DXIL `; Buffer Definitions` comment block and the `rawBufferLoad` element offset). Cause: `HLSLStructuredBufferLayoutRulesImpl` (slang-type-layout.cpp:997-1008) inherits the non-rounding `DefaultLayoutRulesImpl::EndStructLayout`. HLSL emit only prints the struct, so DXC decides the real layout.

Every other target's SB reflection matches its emitted code: SPIR-V std430 16/24, SPIR-V scalar 12/16 (explicit Offset decorations), via-GLSL 16/24, CUDA PTX reads base+16.

`ByteAddressBuffer.Load<T>` uses natural layout (byte 12) on EVERY target unless `-fvk-use-gl-layout` is set (slang-ir-byte-address-legalize.cpp:610-631). So raw loads disagreeing with structured buffers is not D3D-only.

Quick differential: run `slangc -target dxil-asm` and `-pass-through dxc` and compare the `rawBufferLoad` offsets. The local Release build ships libdxcompiler.so.

Note: `getTypeLayout(type, LayoutRules::Default)` on HLSL uses CONSTANT-BUFFER rules. Only `DefaultStructuredBuffer` and entry-point SB params use the SB rules (getInitialLayoutContextForTarget, type-layout.cpp:3036-3080).
