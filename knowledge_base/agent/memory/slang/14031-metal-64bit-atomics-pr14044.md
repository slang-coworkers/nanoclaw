---
type: chain
title: slang#14031 / draft PR #14044: Metal 64-bit atomics (ulong texture atomic_min/max)
description: Bot draft PR #14044 (Fixes #14031), owned by slang-fixer session sess-1793291446093-uqb9b4 on gh-issue-shader-slang/slang-14031, assigned to jhelferty-nv. After #14210 merged I told it to merge master and move its 64-bit check into checkUnsupportedInst; it is now at b360ff2a7. PARKED on the reporter's M4 xcrun-metal check (11-06); re-check recheck-14044-reporter-m-da20 11-10 23:00Z.
tags: [metal, atomics, 64-bit, draft, ci-docs-only-skip]
---

# slang#14031 / PR #14044: Metal 64-bit atomics

- **Owner:** slang-fixer `sess-1793291446093-uqb9b4` (the PR mapping), thread `gh-issue-shader-slang/slang-14031`. Draft; assignee and review request: jhelferty-nv.
- **11-05 21:56Z:** #14210 merged (the [#14060 record](14060-metal-float-atomic-load-exchange-cas.md)). I sent a pinned heads-up (msg 85):
  merge master, then move the 64-bit check into `checkUnsupportedInst` following jkwak-work's direction, quoted verbatim.
- **11-06 23:10Z fixer [Report]:** head `b360ff2a7` (MERGEABLE, draft). The reporter albertrodriguezclo (comment 6697863718)
  confirmed the M4 split. Void `atomic_min/max_explicit` on `device atomic_ulong*` works, and nothing else on `atomic_ulong` compiles. The reporter
  also offered to compile the PR's MSL with `xcrun metal`. The fixer replied with the MSL and the command (6698079154).
  **CI correction:** dispatches 40933299420, 40945200884 and 42121529704 skipped all 44 jobs because each docs-only tip commit made the `HEAD^1` filter skip everything.
  I verified 42121529704. **No CI has built this code;** the only evidence is local (tests/metal 236/236).
- **My decision (11-06):** (a) wait for the reporter's M4 result. No temp upstream branch, because a bot dispatch would yield at
  `wait-for-human-priority` anyway. Keep a code commit as the branch tip on the next push. CI runs on the ready-flip. The existing shared learnings
  already cover the docs-only dispatch trap (a9tac8 10-16, apezq5 11-06), so I wrote no new learning.
- **Do not** comment on #14170 (the reporter's own PR).
