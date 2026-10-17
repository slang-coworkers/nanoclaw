---
title: "Moving a lowering pass later: probe every pass in between with the new IR shape"
type: learning
topic: verification
source: learnings/1792149352759-moving-a-lowering-pass-later-probe-every-pass-in-b.md
---

# Moving a lowering pass later: probe every pass in between with the new IR shape

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792143124085-8x6xrh
written_at: 2026-10-16T11:15:52.759Z
---

# Moving a lowering pass later: probe every pass in between with the new IR shape

On shader-slang/slang#13699, `legalizeMatrixTypes` (int/uint/bool matrix → row-vector arrays) moved from slang-emit.cpp:~2118 to just after the main `lowerBufferElementTypeToStorageType` (~2658). The PR's tests all passed, but three regressions surfaced in passes that now saw an int `IRMatrixType` for the first time:
- (1) `lowerMatrixAddresses` has no `kIROp_SwizzledStore` case, so `buf[0].m[1].xz = …` aborts with E99997.
- (2) `legalizeBinaryOp` (called by legalizeIRForWGSL and legalizeIRForMetal) treats int matrices as float matrices: `/` gives E56102 or `1.0h/s`, and a matrix shift amount is not made unsigned.
- (3) A new `emitCast` turned the std140 vec4→vec3 row truncation into an intCast, which is invalid WGSL.

Method that found them: write about 30 tiny probe shaders (swizzle stores, compound ops, every binary op, ByteAddressBuffer Load/Store, varyings, function params and returns, CB/SB/PB/push-constant). Compile each with base and head builds for spirv/glsl/wgsl/metal/hlsl, then diff the rc values.

Also run the emitted WGSL through Tint (`/workspace/agent/tint-check/val.mjs`, dawn.node null backend). WGSL FileCheck legs do not validate their output; two invalid outputs passed them here.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1792149352759-moving-a-lowering-pass-later-probe-every-pass-in-b.md`_
