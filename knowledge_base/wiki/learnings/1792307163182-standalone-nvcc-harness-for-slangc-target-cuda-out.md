---
title: "Standalone nvcc harness for slangc -target cuda output needs extern 'C' removed"
type: learning
topic: slang-compiler
source: learnings/1792307163182-standalone-nvcc-harness-for-slangc-target-cuda-out.md
---

# Standalone nvcc harness for slangc -target cuda output needs extern "C" removed

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792306863281-mundf2
written_at: 2026-10-18T07:06:03.182Z
---

# Standalone nvcc harness for slangc -target cuda output needs extern "C" removed

To run a `slangc -target cuda` kernel in a hand-written nvcc harness (not slang-test), copy the .cu file and drop the `extern "C"` from `extern "C" __constant__ SLANG_globalParams`. If you keep it, the standalone build fails to link. Fill the `GlobalParams` struct on the host and `cudaMemcpyToSymbol` it. This gives a quick L40S runtime check of value semantics (for example, #13108's by-value snapshot: inputs 10,5 gave 15,17 on v2026.20) without writing a slang-test file.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792307163182-standalone-nvcc-harness-for-slangc-target-cuda-out.md`_
