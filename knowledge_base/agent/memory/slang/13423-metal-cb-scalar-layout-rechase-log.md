---
type: chain-log
title: slang#13423 / PR #13425 — dated re-chase log
description: Per-re-chase readings of draft PR #13425 (10-06 → 10-21); the durable decisions and lessons live in the chain record, new re-chases append here
---

# slang#13423 / PR #13425 — re-chase log

Chain record (decisions, collision table, lessons): [[slang/13423-metal-cb-scalar-layout.md]].
New re-chase entries go **here**, one bullet each. When this file nears 12 KB, prune the oldest "no change" bullets.
Every entry below found 0 human reviews or comments on #13425/#13423, an assignee/review request of kaizhangNV, and #13386 + #13300
still unmerged drafts, unless it says otherwise.

- **10-04 17:07Z** — draft `278cdfaa01`, 14 files +540/−24. slang-reviewer r2 APPROVE_WITH_NITS. The r1 🔴 ICE (`IRCopyLogical` reaching a
  non-SPIR-V emitter on scalar CB → RWStructuredBuffer copy) was fixed at the producer with `canCopyStorageValueDirectly`. Codex CODE + OUTPUT
  approve. `k_maxSupportedModuleVersion` 33→34. Dispatch run 37218415580 `waiting`; pull_request CI skipped (draft).
- **10-06 09:00Z** — no change; `BEHIND`, no conflicts. On 10-05 jhelferty-nv reassigned #13423/#13379/#13386 to **jkwak-work** (milestone Q4
  2026 Fall); the PR assignee mismatch was reported to the dashboard (msg 7).
- **10-09 09:00Z** — **CONFLICTING** (collision 1, master #13445). Triager msg 13 → fixer **merged** origin/master (no force-push authorized, same
  practice as #13436); new head **`465250e5ac`**, id 908 / max 35, verified MERGEABLE 0 behind / 5 ahead. Dashboard msg 15.
- **10-12 09:00Z** — no change; BEHIND 5, none touching the PR's files or stable-names/version. **Run 37218415580 now 404s**, so no
  metallib/vk/mtl CI has ever run on any head. Dashboard msg 5.
- **10-15 09:00Z** — **CONFLICTING/DIRTY** (collision 2, master #13116), ahead 5 / behind 30. Triager msg 7 (pinned
  `sess-1791054731206-u100ia`): id 909 / max 36. Dashboard msg 13.
- **10-15 13:00Z** — merge verified: head **`c994d094e1`** (merge of `6597ec9202`), MERGEABLE, 0 behind / 6 ahead, 14 files +541/−24, 909 / 36,
  gate kept. Triager reported at 09:19Z (msg 37). PR 5-bullet comment 6078307404 edited in place (tests 12/12, unit 648/648, 4345/4345 across
  12 suites — their claim, not re-run). Only REUSE + PR Maintenance ran. Dashboard msg 15.
- **10-15 14:15Z** — from the [[slang/13555-ignore-capabilities-caseless-target-switch.md]] chain: draft #13564 also claims 909 / max 36, and
  non-draft #13406 (jhelferty-nv) sets min=max=36. Whichever merges second renumbers; don't renumber early.
- **10-18 09:00Z** — no change; BEHIND 11 (master `60a7c8c88c`), merge-tree clean, master ids still ≤ 908. #13564 draft MERGEABLE; #13406
  CONFLICTING + CHANGES_REQUESTED. Dashboard msg 3.
- **10-21 09:00Z** — **CONFLICTING/DIRTY** (collision 3, master #13078 `9e17a9e850`), 32 behind master `25fc396601`; merge-tree conflicts only in
  stable-names.lua (`slang-ir.h` auto-merged — see lesson 2 in the record). Triager msg 9 (pinned `sess-1791054731206-u100ia`): merge origin/master,
  id **910**, max **37**, min 34, fix the version comment, keep the gate, and test two auto-merging master commits — jkwak-work's #13715
  (`8aabff120f`, `legalizeMatrixTypes` after buffer lowering, lower-buffer-element-type.cpp) and #13724 (`69ad6c11de`, entry-point-uniforms.cpp).
  No CI runs since 10-15. #13406 now `e5ac28a647` min=max=**37**, MERGEABLE + CHANGES_REQUESTED; #13564 draft CONFLICTING. Dashboard msg 11.
  Next: `rechase-13425-merge-veri-b035` 10-21 13:00Z, then `rechase-13425-maintainer-e658` 10-24 09:00Z.
- **10-22 16:35Z** — this is a three-way collision on **910**. #13425 (`3a41ab51a`, `Type.MetalConstantBufferLayout` = 910, max 37) is
  CONFLICTING/DIRTY again and was last updated 10-21 09:23Z. Draft #13872 (#13841, `DebugVarStorage` = 910, v38) and draft #13564 (#13555,
  `noTargetCase` = 910, v38) claim the same id. Master is at 909 / v37. #13564's PR body now records the merge order. Rule: whichever merges later
  takes the next free id; don't renumber early. The 10-24 re-chase should re-read master's max id and version before dispatching a merge.
- **10-24 09:00Z** — **CONFLICTING/DIRTY** (collision 4), head `3a41ab51a0` 7 ahead / 34 behind master `52e29ab43b`. Merge-tree conflicts:
  `slang-ir.h` (#13406 `0bd71cd709`, merged 10-22, min=max=**37**, equal to the PR's max) and `slang-ir-entry-point-uniforms.cpp` (#13706
  `340047a3ce`, WGSL std140 `isWGPUTarget` branch ahead of the scalar branch the PR guards with `!isMetalTarget`). This was the first real code
  conflict; the earlier ones were numbers only. Master's max id is still 909, so stable-names auto-merges and 910 stays. #13564 / #13872 / #13386 / #13300 are all
  still drafts. Triager msg 9 (pinned): merge origin/master, 910 / min 37 / max 38, WGPU branch first then the Metal guard, keep the gate, run the
  #13706 WGSL test + unit tests. **Correction:** workflow_dispatch run 39575875464 on `3a41ab51a0` has been `waiting` (unapproved) since 10-21 09:18Z,
  so "no dispatch run" was wrong. Dashboard msg 11. Next: `rechase-13425-merge-veri-9b68` 10-24 13:00Z, then `rechase-13425-maintainer-1a96` 10-27 09:00Z.
- **10-24 13:00Z** — **collision 4 resolved, verified.** New head `4b7541ad55` is a real merge commit (parents `3a41ab51a0` + master
  `52e29ab43b`, pushed 09:05Z, no rewrite); MERGEABLE (BLOCKED = draft), 8 ahead / 0 behind, merge-tree clean; master has not moved. Compared
  directly against master: id 910 (master max 909), min 37 / max 38 (master min=max 37), `IRTypeLayoutRuleName::MetalConstantBuffer = 8` (master
  ends `LLVM` = 7). The #13706 `isWGPUTarget` branch is first, then the `!isMetalTarget` guard on the scalar branch. Gate present. Comment
  6078307404 edited 09:23Z for the new head (fixer-reported: 15/15 PR tests vk+cuda, 656/656 unit, #13706 WGSL test 3/3). Dispatch run
  39575875464 was **cancelled** 09:17Z and replaced by 40081357382 on `4b7541ad55`, `waiting` (unapproved). #13564 / #13872 / #13386 / #13300 are still
  open drafts with unchanged heads. 0 human activity. No nudge or dashboard post was needed. The 10-27 `rechase-13425-maintainer-1a96` prompt now has the verified numbers.
- **10-27 09:00Z** — **no collision, no human activity.** Head `4b7541ad55` has not changed. The PR is MERGEABLE and BEHIND by 3: master `9a4817c881` added #13665 `bba63c2376`, #13879
  mimalloc `f805738159` and a CONTRIBUTING edit. None of the three touches the PR's 14 files, stable-names or `slang-ir.h`. merge-tree is clean. I compared directly against master: PR id 910 / min 37 / max 38 / `MetalConstantBuffer` = 8,
  master 909 / 37 / 37 / `LLVM` = 7. Gate kept. Dispatch run 40081357382 is still `waiting` (unapproved), and the pull_request jobs were skipped (draft). 0 reviews/comments; assignee + review request are still kaizhangNV.
  #13386 / #13300 (CONFLICTING) / #13564 / #13872 are still open drafts with unchanged heads. No triager nudge. Dashboard msg 3. Next: `rechase-13425-maintainer-fba7` 10-30 09:00Z.
- **10-30 09:00Z** — **no collision, no human activity.** Head `4b7541ad55` has not changed. The PR is MERGEABLE and BEHIND by 29 (master `1f0b33b868`). The 26 commits since `9a4817c881` include #14022 int-matrix lowering, #13922 Metal interpolation and a WGSL batch; none touches the PR's 14 files, stable-names or `slang-ir.h`, and merge-tree is clean. Compared directly: PR 910 / 37 / 38 / `MetalConstantBuffer`=8, master 909 / 37 / 37 / enum ends `LLVM`(=7).
  Dispatch run 40081357382 is still `waiting`. 0 reviews/comments; the assignee and review request are still kaizhangNV. #13386 / #13300 (CONFLICTING) / #13564 / #13872 are unchanged open drafts.
  **New v38 claimants:** bot drafts #13953 (min=max 38, no id) and #13992 (max 38, no id; cross-referenced #13425 on 10-28). No triager nudge was needed. Dashboard msg 5. Next: `rechase-13425-maintainer-9443` 11-02 09:00Z.
