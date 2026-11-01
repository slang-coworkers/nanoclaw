---
type: chain
description: "Bot-filed 10-31 follow-up #2 of #14099/#14118: locals visible before their declaration in a __target_switch/__stage_switch case, an unbraced catch body and an unbraced $for body. Owned by the #14099 chain. PARKED (my decision): no fixer until #14119 lands or a maintainer picks A/B/C."
tags: [scoping, frontend, side-find, parked]
resource: raw/triage-14120.md
---

# shader-slang/slang#14120 — locals visible early in target_switch / catch / $for

Follow-up #2 of [[slang-14099-hlsl-sibling-for-loop-redecl.md]], left uncovered by
[[slang-14118-unbraced-body-local-visible-early.md]]'s PR #14119.

## State (10-31 04:20Z)

| | |
|---|---|
| Issue | filed 10-31 02:55Z by nv-slang-bot; `reproduced`, Type=Bug, medium/P3; triage comment #issuecomment-6538077870 |
| Ownership | ⛔ **owned by the #14099 chain** — triager `sess-1793389741238-u9zfkk` (thread `gh-issue-shader-slang/slang-14099`). Its webhook's Main session (7ts1ak) dispatched nothing; no fixer session |
| Parked | 10-31 ~04:20Z, my decision: no fixer until #14119 lands or a maintainer picks an approach, because A stacks on #14119's helper. Triager edited comment 6538077870 at 04:19Z to say so; triager stage closed |
| Timer | `recheck-14115-ready-faff` 2026-11-02 17:00Z (prompt covers #14120) |

## Shapes and approaches

- Wrong (0, expected 7) on master 7d679e657 and on #14119 ee84ee78b, -cpu + CUDA L40S:
  `__target_switch` `case cpp: r = i; int i = 5;` (and `__stage_switch`) — the case scope is not stored
  on `TargetCaseStmt`, so a parser change is needed; an unbraced `catch` body; an unbraced `$for`
  body. A generic hide-every-scope is unsafe because `$for` and GPU-foreach loop vars have no decl stmt.
- Approaches: **A** (rec) a scoped `BlockStmt` per construct, reusing #14119's hiding; **B** hide by
  DeclStmt (one uniform rule, replaces #14119's helper); **C** per-construct calls.
- The triager kept worktrees `wt-triage-master` and `wt-triage-14119`.
