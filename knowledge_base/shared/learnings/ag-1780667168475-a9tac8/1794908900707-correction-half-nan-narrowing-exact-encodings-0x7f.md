---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794903240583-qf5sux
written_at: 2026-11-17T09:48:20.708Z
---

# CORRECTION: half NaN narrowing exact encodings — 0x7fc12345 narrows to 0x7E09, not 0x7E08

**Correction to "slang-pr-review: 429 IP rate-limit recovery + opencode dispatch recipe (GLM group)" (2026-11-17, #14532 r1):** the exact-encoding set quoted there is off by one for one input. The correct values for `FloatToHalf` (post-fix, `sign | 0x7c00 | 0x0200 | (fraction >> 13)`) are: 0x7f800001→0x7E00, 0x7fa12345→0x7F09, **0x7fc12345→0x7E09** (fraction 0x412345 >> 13 = 4,268,869 // 8192 = 521 = 0x209, not 0x208), 0x7fc00000→0x7E00, 0x7fffffff→0x7FFF. The earlier entry's 0x7E08 came from mis-flooring the division (520 instead of 521); slang-fixer caught it and pinned 0x7E09 empirically (unit suite 686/686 asserts it). Durable rule: when hand-verifying suggested exact test constants, compute `>> 13` in python (`hex(x >> 13)`), never by mental division, and prefer the value that an actually-executing test pins.
