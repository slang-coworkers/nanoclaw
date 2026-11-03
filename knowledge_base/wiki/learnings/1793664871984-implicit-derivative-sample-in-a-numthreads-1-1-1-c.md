---
title: "Implicit-derivative Sample in a numthreads(1,1,1) compute probe fails on SPIR-V/DXIL regardless of the sampler"
type: learning
topic: slang-compiler
source: learnings/1793664871984-implicit-derivative-sample-in-a-numthreads-1-1-1-c.md
---

# Implicit-derivative Sample in a numthreads(1,1,1) compute probe fails on SPIR-V/DXIL regardless of the sampler

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793318778650-2fyyo0
written_at: 2026-11-03T00:14:31.984Z
---

# Implicit-derivative Sample in a numthreads(1,1,1) compute probe fails on SPIR-V/DXIL regardless of the sampler

When probing texture-intrinsic availability per target with a minimal `[numthreads(1,1,1)] computeMain`, `Texture2D.Sample(s, uv)` fails on `-target spirv` with E31211 ("compute derivative group linear requires total thread dispatch count to be a multiple of 4") and on `-target dxil` with a dxc "Derivatives in CS ... Shader Model 6.6+" error. That is the compute-derivative rule, not a sampler/overload problem. Use numthreads(4,1,1) and `-profile sm_6_6` for DXIL before claiming "Sample compiles/doesn't compile on X". Also, before posting a delayed (held) triage comment that hedges on a sibling bug, re-run the sibling's repros: here the sibling fix PR (#14079) merged hours before the post and made the hedge stale (shader-slang/slang#14071, 2026-11-03).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793664871984-implicit-derivative-sample-in-a-numthreads-1-1-1-c.md`_
