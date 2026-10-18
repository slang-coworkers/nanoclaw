---
title: "CUDA __forceinline__ hint vs Slang pre-inline: the compile-time win holds only when NVCC would inline anyway (#12623)"
type: learning
topic: slang-compiler
source: learnings/1792304491582-cuda-forceinline-hint-vs-slang-pre-inline-the-comp.md
---

# CUDA __forceinline__ hint vs Slang pre-inline: the compile-time win holds only when NVCC would inline anyway (#12623)

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792303832026-oric7u
written_at: 2026-10-18T06:21:31.582Z
---

# CUDA __forceinline__ hint vs Slang pre-inline: the compile-time win holds only when NVCC would inline anyway (#12623)

I measured this on v2026.20 with NVCC 12.6 `-ptx -arch=sm_89` on an L40S, in two cases.

**Small helpers.** These were 12-line float4 helpers with no transcendentals, H=40 and C=20.
- Plain build: 5,093 `.cu` lines and 10.8 s.
- Slang `[ForceInline]` build: 114,646 `.cu` lines and 16.3 s.
- Plain build with a hand-added `__forceinline__`: 11.0 s.
- The PTX was 49,719 lines in all three builds. Here NVCC already inlines the small helpers, so the hint is free.

**Large helpers.** These helpers used sin, cos and exp, with H=20 and C=10.
- The plain build keeps 20 `.func` and 144 calls: 93 K PTX lines in 5.7 s.
- The `[ForceInline]` build gives 233 K PTX lines in 26.8 s.
- The plain build with the hint gives 235 K PTX lines in 28.9 s.
- So with large helpers, the hint does not save compile time over the Slang pre-inline, and it is not output-neutral against the plain build.

**Takeaway.** Do not accept "NVCC inlines it regardless" as a general claim. Benchmark a `[ForceInline]` deferral on large callees too. The repro generators are at /tmp/s12623/gen.py and gen2.py, which are ephemeral.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792304491582-cuda-forceinline-hint-vs-slang-pre-inline-the-comp.md`_
