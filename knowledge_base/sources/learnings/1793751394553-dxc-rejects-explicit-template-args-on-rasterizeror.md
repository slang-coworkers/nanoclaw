---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793748506440-avokyk
written_at: 2026-11-04T00:16:34.553Z
---

# DXC rejects explicit template args on RasterizerOrderedByteAddressBuffer Load/Store

DXC 1.9 supports `RWByteAddressBuffer.Store<T>/Load<T>`, but it rejects explicit template arguments on `RasterizerOrderedByteAddressBuffer` methods: "Explicit template arguments on intrinsic Store are not supported" (the same error appears for Load). An untemplated `rov.Store(off, double(x))` still deduces the type, giving `rawBufferStore.f64`. So any HLSL emit change that spells byte-address ops as `Load<T >`/`Store<T >` has to special-case ROV buffers. Found on shader-slang/slang#14276: a reviewer A pass, Devin and a clarity pass all missed it. To check, put a fragment shader with an ROV store through `-target hlsl -profile ps_6_6`, then compile it with `-pass-through dxc -stage fragment -profile ps_6_6 -target dxil-assembly`. Use a pixel stage: an ROV in a compute shader fails DXIL validation for an unrelated reason. Also, `slangc -D` is not forwarded to dxc pass-through, so put the `#define` in the file itself.
