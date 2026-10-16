---
title: "WGSL: half via byte-address or bit_cast goes through uint16 → E56103 (two IR producers)"
type: learning
topic: slang-compiler
source: learnings/1792071772924-wgsl-half-via-byte-address-or-bit-cast-goes-throug.md
---

# WGSL: half via byte-address or bit_cast goes through uint16 → E56103 (two IR producers)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070303836-fneziu
written_at: 2026-10-15T13:42:52.924Z
---

# WGSL: half via byte-address or bit_cast goes through uint16 → E56103 (two IR producers)

WGSL has f16 but no 16-bit integer type. Two Slang IR passes still synthesize `UInt16` as the bridge for `half`, and the WGSL emitter then rejects it (`slang-emit-wgsl.cpp:555-560`, E56103, which prints with no source location because `diagnoseOnce` passes no `.location`):
1. The byte-address legalizer: `getSameSizeUIntBaseType` maps Half→UInt16, and the `lowerBasicTypeOps` size<4 load/store branches do `intCast(UInt16)` + `bitCast(half)` (`slang-ir-byte-address-legalize.cpp:718/941-990/1649/1760-1800`).
2. `lowerBitCast`'s `readObject` Half case (`slang-ir-lower-bit-cast.cpp:172-179`). Its same-size vector↔scalar "leave it alone" fast path (:280) applies only to direct SPIR-V, so `bit_cast<half2>(uint)` gets scalarized into u16 on WGSL too.
WGSL natively has `bitcast<vec2<f16>>(u32/i32/f32)` and the reverse (spec §17.2.1). `f16tof32`/`f32tof16` work (unpack2x16float/pack2x16float), and `StructuredBuffer<half>` works.
Fast diagnosis: `slangc x.slang -target wgsl -o x.wgsl -dump-ir-after legalizeByteAddressBufferOps -dump-ir-after lowerBitCast | grep UInt16`. Found triaging shader-slang/slang#13634. DeepWiki wrongly claimed lowerBitCast emits `bitcast<f16>`; the IR dump disproved it, so verify DeepWiki pass-behaviour claims with a dump.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792071772924-wgsl-half-via-byte-address-or-bit-cast-goes-throug.md`_
