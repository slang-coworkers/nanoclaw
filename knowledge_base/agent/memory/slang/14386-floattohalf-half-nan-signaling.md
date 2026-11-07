---
type: chain
title: slang#14386 — `FloatToHalf` narrows every NaN to the signaling NaN 0x7C01/0xFC01
description: Bot-filed 2026-11-06 16:14Z by slang-triager, side-find S4 from review of draft PR #14385 (#14259 chain). Bug + `reproduced`. FILED-ONLY (low severity; overlaps human NaN work); one-shot recheck-14386-floattohal-2ff9 (11-13 12:00Z).
tags: [half, nan, constant-folding, spirv-emit, core-math, side-find, filed-only]
---

# slang#14386 — half NaN constants become a signaling NaN

**Bug.** `FloatToHalf` (`source/core/slang-math.h:222-227`) returns `sign | 0x7c00 | (fraction != 0)` for any NaN, so
a quiet NaN narrows to `0x7C01`/`0xFC01` (quiet bit clear, payload 1), a signaling NaN. Callers: SPIR-V constant emit
(`slang-emit-spirv.cpp:1134`, `:1259`) and half constant folding (`slang-check-expr.cpp:7450`, `:7481`). On VK/L40S,
`half(0.0 / 0.0)` reads `FC01`, while the `float`/`double` constants are quiet. Expected: keep sign, quiet bit and top
payload (`sign | 0x7C00 | (fraction >> 13)`), forcing a non-zero payload only if the shift leaves 0. Not a regression.

**Origin.** Found in review of [#14259](14259-hlsl-byte-address-store-double-untyped.md)'s third PR #14385 (HLSL typed
half / NaN / ±Inf literals). The triager owner session sess-1793741880740-mvymkh filed it and did not route it. Separate
from #13909 / #14161 (text-emitter NaN).

**GitHub (11-06 16:14Z).** Open, label `reproduced`, Type=Bug, 0 comments, no assignee. The issue body is the resumable
artifact; no bot comment posted.

**Decision (11-06 16:18Z, Main session sess-1793981657033-exfjo9, the issue_opened owner): no dispatch, FILED-ONLY.**
- Low severity: the value is still a NaN; only the quiet bit differs, and GPUs do not trap on signaling NaNs.
- The NaN arm's comment ("does not preserve the NaN payload or distinguish quiet NaNs from signaling NaNs") was written
  on purpose by maintainer skallweitNV in #13485 (merged 10-09), so changing it is a design change to that author's code.
- Human PR #13927 (albertrodriguezclo, BEHIND, not draft) adds NaN-bit helpers to `slang-math.h` right above
  `FloatToHalf`; it does not change the NaN arm. The same contributor owns the related #13857 / #13909 NaN work.
- No collision with #14385 (`slang-emit-hlsl.cpp` only) or #14276.
- slang-fixer had 4 running sessions, so load was not the reason.

**Timer.** One-shot `recheck-14386-floattohal-2ff9` (11-13 12:00Z). Its table: relay a human comment to the triager;
hold if a human is assigned or has a PR; otherwise dispatch slang-fixer on `gh-issue-shader-slang/slang-14386` (draft,
`Fixes #14386`, SPIR-V filecheck + VK test, leave #13927's helpers alone) and tell the dashboard; re-arm once if the
fixer is loaded. **Resumes earlier on:** a human comment, a maintainer `bot-ok`/assignment, or an operator go-ahead.
