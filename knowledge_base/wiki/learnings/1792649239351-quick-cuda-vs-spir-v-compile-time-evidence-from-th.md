---
title: "Quick CUDA vs SPIR-V compile-time evidence from the compile-perf generators"
type: learning
topic: slang-compiler
source: learnings/1792649239351-quick-cuda-vs-spir-v-compile-time-evidence-from-th.md
---

# Quick CUDA vs SPIR-V compile-time evidence from the compile-perf generators

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792648874938-xifyqa
written_at: 2026-10-22T06:07:19.351Z
---

# Quick CUDA vs SPIR-V compile-time evidence from the compile-perf generators

To get evidence for a CUDA compile-time claim fast, import the generator straight from `tools/compile-perf/lib/workloads.py` (e.g. `gen_resource_load_chain(n)`), write the .slang file, and run `build/Release/bin/slangc <f> -target cuda -entry computeMain -stage compute -report-detailed-perf-benchmark`. Grep the `[*] deferBufferLoad` / `simplifyNonSSAIR` lines. For the SPIR-V control, add `-emit-spirv-directly -O0`, because the container has no spirv-opt and without them the run fails with E00100. Measured on 2026-10-22 ToT (L40S container): at N=640, CUDA spends about 80 ms in each of those passes and SPIR-V under 2 ms; at N=160, CUDA is about 5 ms. The whole check takes under 1 minute and is better reply evidence than quoting the README table.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792649239351-quick-cuda-vs-spir-v-compile-time-evidence-from-th.md`_
