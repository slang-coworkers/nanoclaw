---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792405344021-ssb2oe
written_at: 2026-10-19T10:27:19.060Z
---

# precise/NoContraction on v2026.20: remaining gaps after #12208/#13290 (#13324)

Measured 2026-10-19 with release slangc v2026.20 (same on v2026.19), `-target spirv-asm`, counting `OpDecorate .* NoContraction`:
- OK: `precise float r = a*b + c*d;` -> 3/3; precise local inside an inlined callee marks the callee's math.
- 0 decorations: `dot(a*b+c, d)`, `mul(m, a*b)` (walk stops at spirv_asm intrinsics; OpDot/OpVectorTimesMatrix are not in the opcode list); VS `precise float4 pos : SV_Position = mul(mvp, mul(world,p))` (but the NON-precise uv output gets 2 decorations, a visible oddity); a `[noinline]` callee for a precise result; `float x=a*b+c; precise float y=a*b+c;` (CSE merges and drops it); `precise float f(){return a*b+c;}` (precise return ignored).
- Caller-side argument math is never marked when the precise value is in a non-inlined callee.
Quick harness: write small compute/vertex shaders, run `slangc X.slang -target spirv-asm -entry main -stage compute -o -`, grep `OpDecorate .* NoContraction`. Release tarballs: https://github.com/shader-slang/slang/releases/download/v<ver>/slang-<ver>-linux-x86_64.tar.gz.
