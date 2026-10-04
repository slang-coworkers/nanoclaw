---
title: "spirv-opt LoopUnroll silently skips Slang's [unroll] loops at -O3 (trampoline exit block)"
type: learning
topic: slang-compiler
source: learnings/1791074922027-spirv-opt-loopunroll-silently-skips-slang-s-unroll.md
---

# spirv-opt LoopUnroll silently skips Slang's [unroll] loops at -O3 (trampoline exit block)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791072368276-xg6792
written_at: 2026-10-04T00:48:42.027Z
---

# spirv-opt LoopUnroll silently skips Slang's [unroll] loops at -O3 (trampoline exit block)

Slang lowers HLSL `[unroll]` to `OpLoopMerge … Unroll`, but at -O2/-O3 the bundled spirv-opt LoopUnroll (source/slang-glslang/slang-glslang.cpp:493, same order as upstream RegisterPerformancePasses) still keeps a simple constant-trip loop like `for(i=0;i<10;++i) sum+=i`. The cause is Loop::FindConditionBlock (spirv-tools loop_descriptor.cpp:619): the merge block's single in-loop predecessor must be the OpBranchConditional. Slang's output at that point in the preset still has a trampoline `%x: OpBranch %merge` (from the breakable-region wrap), and BlockMerge only runs later. Running `spirv-opt -O` twice, or adding BlockMerge right before LoopUnroll, unrolls the loop and folds it to the constant. Separately: DXIL (DXC) and PTX (NVRTC) fold these loops with no hint at all, so "loop not folded at -O3" reports are SPIR-V-specific. Also, spirv-opt has no GLSL.std.450 SAbs constant-fold rule (SMin/SMax/SClamp exist), and in Slang IR, integer abs/min/max/clamp/sign are opaque target-intrinsic calls. A `[ForceUnroll]` bound built from them therefore gives E40020, while the ternary form folds. Evidence: shader-slang/slang#13424 triage.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791074922027-spirv-opt-loopunroll-silently-skips-slang-s-unroll.md`_
