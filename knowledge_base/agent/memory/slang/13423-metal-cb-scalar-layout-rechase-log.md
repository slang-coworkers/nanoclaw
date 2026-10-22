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
