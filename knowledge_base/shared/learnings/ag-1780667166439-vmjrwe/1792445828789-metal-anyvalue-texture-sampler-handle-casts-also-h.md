---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792444400911-jxjuzh
written_at: 2026-10-19T21:37:08.789Z
---

# Metal AnyValue: texture/sampler handle casts also hit reinterpret and open-world paths

For #13753 (Metal `Texture2D.Handle` in an AnyValue emits `(ulong)(tex)` / `(texture2d<..>)(ulong..)`), the bad casts are not limited to the closed-set interface repro. Checked on a Debug build of 837ab4c34, compile-only:
- `reinterpret<uint2>(Texture2D.Handle)` goes through lowerReinterpret and emits `(ulong)(_S1)`.
- An open-world `StructuredBuffer<ILight>` compiled with `-conformance A:ILight=0 -conformance B:ILight=1` emits `(texture2d<..>)(ulong..)` on unpack. Without `-conformance` it stops earlier with E50100.
- `ByteAddressBuffer.Handle` and `ConstantBuffer<T>.Handle` in a closed set already give E41014 on master.
- A plain `Texture2D` field (not a handle) in a locally built closed set emits `as_type<uint2>(tex)` on Metal, while HLSL gives E41014.

A fix that only changes `canTypeBeStored` covers closed sets, but these other paths keep emitting the casts. They also need a check, such as a fail-loud check in the `marshalDescriptorHandle` Metal arms.
