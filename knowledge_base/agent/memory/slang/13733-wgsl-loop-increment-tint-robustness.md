---
type: chain
title: slang#13733 — WGSL loops put the increment in the body, so Tint robustness blocks unrolling
description: "albertrodriguezclo, human-filed 10-17. Follow-on to #13066/PR #13071. Triaged P2 enhancement, parked on a maintainer (jkwak-work) choice of emission shape. No fixer handoff."
---

# slang#13733

**2026-10-17 14:54Z, `issue_opened`.** Live read before dispatching: OPEN, 0 comments, no labels, human-filed
by albertrodriguezclo (same reporter as slangpy#1232 / slang#13713). Related #13066 closed 09-28 by PR #13071
(BarthPaleologue, merged 09-28T20:55Z). Dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13733`.
15:05Z: the reporter commented with the Tint tracker https://issues.chromium.org/issues/574559077, and I relayed it to the triager.

**15:42Z, triaged** ([cmt 6235943785](https://github.com/shader-slang/slang/issues/13733#issuecomment-6235943785),
checked live: nv-slang-bot, label `reproduced`, Type=Feature, no assignee; memo
`/workspace/inbox/a2a-1792251774388-c62tc2/triage-13733.md`). Enhancement / medium / P2 / WGSL emit + IR restructure.
The triager reports the following (not re-run by me):
- Reproduced on master 60a7c8c88. The shape comes from #13071. It is not a regression: 2026.13.1 `for(;;)` gets the same Tint counter. Dawn/Vulkan on the L40S shows the counter. The D3D12/DXC numbers were not reproduced.
- Tint LoopAnalysis finds the index only in a WGSL `for` initializer, so `loop{…continuing{inc}}` alone does **not** avoid the counter.
  The only Slang-side shape that works today is `for (var p = init; ; p = p ± 1) { body }` (hand-edited repro confirmed).
- Options: A = WGSL counted-`for` (recommended), B = general `continuing` (not enough on its own), C = the Tint fix.
  For `[unroll]`: D = warn (recommended, W56005 precedent), E = best-effort unroll (changes semantics; E40020).
- Files: `slang-ir-restructure.cpp:397-529`, `slang-emit-c-like.cpp:3854-3880`, `slang-emit-wgsl.h:36`.
- The triager asked the reporter whether they plan to send a PR (they did for #13660/#13645/#13648).

**Side note, checked structurally by me @60a7c8c88c:** `slang-ir-restructure.cpp:321-323` reads the prior
block→region mapping into a *local* `nextSimpleRegionForSameBlock` and never stores it in the field
(`slang-ir-restructure.h:104`). No other writer exists (`git grep` finds 4 hits), so the chain walked at
`slang-ir-restructure-scoping.cpp:389` is always one entry long. Whether this changes behaviour is unverified.
Unfiled: the operator decides.

**Parked on:** maintainer pick (A/B/C, D/E) by @jkwak-work, or a reporter PR. **Timer:** one-shot `recheck-13733-15e7`
(triager group) 10-24 15:00Z. **Resumes on:** a human comment on #13733, a reporter PR, or the recheck firing.
