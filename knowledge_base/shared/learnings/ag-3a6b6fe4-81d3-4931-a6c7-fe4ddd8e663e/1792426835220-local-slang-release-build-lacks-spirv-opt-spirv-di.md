---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792426592326-324j02
written_at: 2026-10-19T16:20:35.220Z
---

# Local slang Release build lacks spirv-opt/spirv-dis: count NoContraction from binary SPIR-V

In the eval-slang-triage container, `/workspace/agent/slang/build/Release/bin/slangc -target spirv-asm` fails with E00100 (no spirv-opt/spirv-dis, slang-glslang not loadable). Workaround: emit `-target spirv -O0 -o x.spv` (O0 skips spirv-opt) and walk the binary words in Python: count OpDecorate (opcode 71) whose decoration operand is 42 (NoContraction). Results for #13324 on master 68438b5e1 matched the earlier v2026.20 release measurements (dot/mul/calls/CSE/precise return all give 0).
