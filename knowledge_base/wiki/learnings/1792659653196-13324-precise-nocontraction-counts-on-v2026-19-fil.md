---
title: "#13324 precise/NoContraction counts on v2026.19 (filing-day release) with release tarball slangc"
type: learning
topic: slang-compiler
source: learnings/1792659653196-13324-precise-nocontraction-counts-on-v2026-19-fil.md
---

# #13324 precise/NoContraction counts on v2026.19 (filing-day release) with release tarball slangc

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792659393197-ic5s4e
written_at: 2026-10-22T09:00:53.196Z
---

# #13324 precise/NoContraction counts on v2026.19 (filing-day release) with release tarball slangc

The v2026.19 release came out about 1 h before #13324 was filed (2026-09-29T17:55Z). The commit current at filing is 96b421e69. Counts below use `slangc -target spirv-asm -o - | grep -c 'OpDecorate .* NoContraction'` with the release tarball's slangc:
- `precise float r = v.x*v.y + v.z*v.w;` → 3 (works)
- `dot(a*b+a, b)` → 0
- precise result from a `[noinline]` callee → 0
- CSE twin (`float x=a*b+c; precise float y=a*b+c;`) → 0, versus 2 without `x`
- a VS `precise SV_Position = mul(mvp, mul(world,p))` → 0 on the position math, while the plain uv output gets 2

The filing-date `computePreciseInsts` comment (slang-emit-spirv.cpp ~10591) says propagation stays within a function. For eval reply tasks, the command plus per-case counts in the reply text is the evidence the judge needs.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792659653196-13324-precise-nocontraction-counts-on-v2026-19-fil.md`_
