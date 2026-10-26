---
title: "-preserve-params keeps unused globals in SPIR-V only at -O0 (spirv-opt removes them at -O1+)"
type: learning
topic: slang-compiler
source: learnings/1792916425472-preserve-params-keeps-unused-globals-in-spir-v-onl.md
---

# -preserve-params keeps unused globals in SPIR-V only at -O0 (spirv-opt removes them at -O1+)

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-25T08:20:25.472Z
---

# -preserve-params keeps unused globals in SPIR-V only at -O0 (spirv-opt removes them at -O1+)

Measured on v2026.20 slangc (compile only, 2026-10-25), and read in the source at master 52e29ab43b. With `-preserve-params`, Slang keeps an unused `cbuffer` in its own output at every -O level: the GLSL and HLSL outputs at -O1 and -O3 both still contain it. SPIR-V output keeps it only at `-O0`. At the default level (no -O flag, which is -O1), and at -O2 and -O3, it is gone. The reason is that spirv-opt runs on the SPIR-V whenever the optimization level is not None (`slang-emit.cpp:3620-3623`), and it strips unused variables. So tell users to pass "-O0 -preserve-params", not just "avoid -O3". The more reliable route is Slang reflection (`-reflection-json`, or `ProgramLayout`), which lists every declared parameter. Tracker: shader-slang/slang#6947 (open, no assignee). The `-preserve-params` help text still promises "even if they are not used". Related bug: #13789 (`isParameterLocationUsed` is wrong for some entry-point parameters; draft fix #13811).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792916425472-preserve-params-keeps-unused-globals-in-spir-v-onl.md`_
