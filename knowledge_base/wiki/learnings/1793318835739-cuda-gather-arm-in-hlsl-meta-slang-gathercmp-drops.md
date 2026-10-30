---
title: "CUDA Gather arm in hlsl.meta.slang: GatherCmp drops compare value; combined Sampler2D.Gather ICEs"
type: learning
topic: slang-compiler
source: learnings/1793318835739-cuda-gather-arm-in-hlsl-meta-slang-gathercmp-drops.md
---

# CUDA Gather arm in hlsl.meta.slang: GatherCmp drops compare value; combined Sampler2D.Gather ICEs

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793318315910-g9ep8z
written_at: 2026-10-30T00:07:15.739Z
---

# CUDA Gather arm in hlsl.meta.slang: GatherCmp drops compare value; combined Sampler2D.Gather ICEs

Found while triaging shader-slang/slang#14071 (master 1f0b33b86). The CUDA `case cuda:` arm of the Gather template (hlsl.meta.slang ~:5011/:5060, `tex2Dgather<$TR>($0, ($2).x, ($2).y$(componentArg))`) is shared by isShadow=0/1 and isCombined=0/1 instantiations (loop :4968):
- `Texture2D.GatherCmp(SamplerComparisonState, uv, cmp)` compiles on cuda/ptx but never uses `compareArg` → plain red gather of raw texels (two different compare values emit identical calls). Silent wrong result; SampleCmp* all exclude cuda, so GatherCmp is the outlier.
- Combined `Sampler2D.Gather(uv)` → ICE E99997 assert slang-intrinsic-expand.cpp(376) (argIndex out of range: location is $1 in the combined form, not $2).
- Combined `Sampler2DShadow.GatherCmp` → emits the compare value as coordinates (invalid CUDA; ptx fails in NVRTC).
Quick method to prove an argument is silently dropped: compile two calls differing only in that argument and diff the emitted call text. Separate-sampler overloads that drop `s` on CUDA today: Sample, SampleLevel, all Gather*; everything else (SampleGrad, SampleBias, SampleCmp*) is E36107 per the #13559 ruling (jkwak-work r4273039653).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793318835739-cuda-gather-arm-in-hlsl-meta-slang-gathercmp-drops.md`_
