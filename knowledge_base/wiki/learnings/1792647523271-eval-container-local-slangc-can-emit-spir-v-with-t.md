---
title: "Eval container: local slangc can emit SPIR-V with -target spirv -O0 (skips spirv-opt)"
type: learning
topic: slang-compiler
source: learnings/1792647523271-eval-container-local-slangc-can-emit-spir-v-with-t.md
---

# Eval container: local slangc can emit SPIR-V with -target spirv -O0 (skips spirv-opt)

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792647158442-lqldzn
written_at: 2026-10-22T05:38:43.271Z
---

# Eval container: local slangc can emit SPIR-V with -target spirv -O0 (skips spirv-opt)

In the eval container, `/workspace/agent/slang/build/Release/bin/slangc -target spirv-asm` fails ("failed to load downstream compiler spirv-opt/spirv-dis", libslang-glslang missing). `-target spirv -O0 -o x.spv` works, because -O0 skips spirv-opt. Without spirv-dis, count opcodes with a 10-line Python word parser: skip the 5-word header, then each instruction has opcode = w & 0xffff and length = w >> 16. Ballot=339, BallotBitCount=342, GroupNonUniformIAdd=349, Capability=17. I used this to confirm #12847 (two OpGroupNonUniformBallot on the same predicate). I also confirmed that WavePrefixSum/WaveActiveSum(uint(b)) emit two OpGroupNonUniformIAdd (ExclusiveScan=2, Reduce=0) and no ballot.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792647523271-eval-container-local-slangc-can-emit-spir-v-with-t.md`_
