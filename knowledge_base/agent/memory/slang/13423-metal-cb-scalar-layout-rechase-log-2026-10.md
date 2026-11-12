---
type: chain-log
title: slang#13423 / PR #13425 — re-chase log, 10-04 → 11-02 (sealed)
description: Sealed October readings of draft PR #13425 (collisions 1–4 and the no-change re-chases between them); live readings from 11-05 on are in the main re-chase log
---

# slang#13423 / PR #13425 — re-chase log, 10-04 → 11-02 (sealed)

Split out of [[slang/13423-metal-cb-scalar-layout-rechase-log.md]] on 2026-11-11 (that file passed 16 KB). Sealed: new entries
go to the live log. The collision table and lessons are in the chain record [[slang/13423-metal-cb-scalar-layout.md]].
Unless an entry says otherwise, every reading found 0 human reviews or comments on #13425/#13423, an assignee/review request of
kaizhangNV, and #13386 + #13300 still unmerged drafts. The no-change re-chases are condensed to their one new fact.

- **10-04 17:07Z** — draft `278cdfaa01`, 14 files +540/−24. slang-reviewer r2 APPROVE_WITH_NITS. The r1 🔴 ICE (`IRCopyLogical` reaching a
  non-SPIR-V emitter on scalar CB → RWStructuredBuffer copy) was fixed at the producer with `canCopyStorageValueDirectly`. Codex CODE + OUTPUT
  approve. `k_maxSupportedModuleVersion` 33→34. Dispatch run 37218415580 `waiting`; pull_request CI skipped (draft).
- **10-06** — no change, BEHIND. On 10-05 jhelferty-nv reassigned #13423/#13379/#13386 to **jkwak-work** (milestone Q4 2026 Fall); the PR
  assignee mismatch went to the dashboard (msg 7).
- **10-09 09:00Z** — **CONFLICTING** (collision 1, master #13445). Triager msg 13 → fixer **merged** origin/master (no force-push authorized, same
  practice as #13436); new head **`465250e5ac`**, id 908 / max 35, verified MERGEABLE 0 behind / 5 ahead. Dashboard msg 15.
- **10-12** — no change, BEHIND 5. **Run 37218415580 now 404s**, so no metallib/vk/mtl CI had run on any head. Dashboard msg 5.
- **10-15 09:00Z** — **CONFLICTING/DIRTY** (collision 2, master #13116), ahead 5 / behind 30. Triager msg 7 (pinned
  `sess-1791054731206-u100ia`): id 909 / max 36. Dashboard msg 13.
- **10-15 13:00Z** — merge verified: head **`c994d094e1`** (merge of `6597ec9202`), MERGEABLE, 0 behind / 6 ahead, 909 / 36, gate kept.
  PR 5-bullet comment 6078307404 edited in place (tests 12/12, unit 648/648, 4345/4345 across 12 suites — their claim, not re-run).
- **10-15 14:15Z** — from the [[slang/13555-ignore-capabilities-caseless-target-switch.md]] chain: draft #13564 also claims 909 / max 36, and
  non-draft #13406 (jhelferty-nv) sets min=max=36. Whichever merges second renumbers; don't renumber early.
- **10-18** — no change, BEHIND 11, merge-tree clean. #13406 CONFLICTING + CHANGES_REQUESTED. Dashboard msg 3.
- **10-21 09:00Z** — **CONFLICTING/DIRTY** (collision 3, master #13078 `9e17a9e850`); merge-tree conflicts only in stable-names.lua
  (`slang-ir.h` auto-merged — lesson 2 in the record). Triager msg 9 (pinned): merge origin/master, id **910**, max **37**, min 34, fix the
  version comment, keep the gate, and test jkwak-work's #13715 (`8aabff120f`, `legalizeMatrixTypes` after buffer lowering) and #13724
  (`69ad6c11de`, entry-point-uniforms.cpp). #13406 now min=max=**37**. Dashboard msg 11.
- **10-22 16:35Z** — three-way collision on **910**: #13425 (`Type.MetalConstantBufferLayout`, max 37), draft #13872 (#13841,
  `DebugVarStorage`, v38) and draft #13564 (#13555, `noTargetCase`, v38). Master at 909 / v37. Rule: whichever merges later takes the next
  free id; re-read master's max id and version before dispatching a merge.
- **10-24 09:00Z** — **CONFLICTING/DIRTY** (collision 4), head `3a41ab51a0` 7 ahead / 34 behind master `52e29ab43b`. First real code conflict:
  `slang-ir.h` (#13406 `0bd71cd709`, merged 10-22, min=max **37**) and `slang-ir-entry-point-uniforms.cpp` (#13706 `340047a3ce`, WGSL std140
  `isWGPUTarget` branch ahead of the scalar branch the PR guards with `!isMetalTarget`). Triager msg 9 (pinned): 910 / min 37 / max 38, WGPU
  branch first then the Metal guard, keep the gate, run the #13706 WGSL test + unit tests. **Correction:** dispatch run 39575875464 on
  `3a41ab51a0` had been `waiting` (unapproved) since 10-21 09:18Z. Dashboard msg 11.
- **10-24 13:00Z** — **collision 4 resolved, verified.** Head `4b7541ad55`, a real merge (parents `3a41ab51a0` + master `52e29ab43b`),
  MERGEABLE, 8 ahead / 0 behind. Id 910 (master max 909), min 37 / max 38, `IRTypeLayoutRuleName::MetalConstantBuffer = 8` (master ends
  `LLVM` = 7); `isWGPUTarget` branch first, then the Metal guard; gate present. Comment 6078307404 edited (fixer-reported: 15/15 PR tests
  vk+cuda, 656/656 unit, #13706 WGSL 3/3). Run 39575875464 cancelled, replaced by 40081357382 (`waiting`).
- **10-27, 10-30, 11-02** — no collision, no human activity; head `4b7541ad55`, BEHIND 3 → 29 → 42, merge-tree clean, PR 910 / 37 / 38 vs
  master 909 / 37 / 37. New v38 claimants: bot drafts #13953 and #13992 (10-30), #14115 (11-02; HLSL for-loop scope). #13872 new head
  `70cb286878` (still 910 / max 38). Dashboard msgs 3, 5, 3.
