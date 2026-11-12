---
type: chain
title: slang PR #11709 — groupshared parameters by reference (fix for #10641)
description: TERMINAL — MERGED 11-11 04:16Z (6862c98ecc, head bf24e9e1f6) by jhelferty-nv after her own rework (maintainer-driven since 10-28; the bot stood down). The 09-30 no_diff-groupshared P1 regression no longer reproduces (rejected by E38038 by policy); the two unpushed bot commits are obsolete and archived. Follow-ups are hers (#14094, #14350, #13747–#13749, #13831) or unowned (#14105, bot-filed).
tags: [slang, frontend, param-passing-mode, groupshared, terminal]
resource: /workspace/extra/ephemeral/prod-groups/slang-fixer/reports/comments/11709-vs-13339-plan-report.md
---

# slang PR #11709: groupshared parameters by reference

Owner: `slang-fixer`, thread `gh-issue-shader-slang/slang-11709`; the pr-mapping still points at the exhausted
session `sess-1785902924001-jylfb4` (ran out of budget 10-09). It was held from 10-01 until the companion Ref-split
PR **#13406** (issue #13339) merged on 10-22; that history is in
[[slang/11709-13406-ref-split-review-rounds.md]]. Pre-October history (five-backend codegen, E30706–E30711, the
CUDA-regression lessons) is in [[imported/project_11709_groupshared_byref.md]].

## Outcome (2026-11-11)

- **10-28:** jhelferty-nv pushed her own rework (`18be59a493`, 64 commits, on top of the merged #13406), so the
  rebase-or-stand-down question the operator never answered (10-22, 10-24) became moot. From then on the bot made
  no push, rerun or post on #11709 unless a maintainer asked it directly; a red `ci_failed` webhook on 10-28 was
  judged not actionable for that reason.
- **10-30:** tangent-vector reviewed the rework. In r4428270534 he asked why the `groupshared` check matches
  source-spelled modifiers instead of the effective passing mode; in r4428479846 he asked `@nv-slang-bot` to open a
  cleanup issue, and slang-fixer filed **#14105** (reply r4428523055).
- **11-11 02:57Z:** she self-approved at `bf24e9e1f6` (review 5853126151); the remaining items, such as
  `QualType` → `ExprInfo` (#13831), became follow-up PRs. **04:16Z: MERGED** (`6862c98ecc`).
- **11-11 04:27Z, TERMINAL.** The bot's unpushed P1 fix `9230f147c` ("Keep a no_diff groupshared parameter a
  reference in its derivatives") and `50c003155` (test tightening) never reached the PR; `git cherry` shows neither
  upstream. slang-fixer re-ran the 09-30 repro (`fwd_diff`/`bwd_diff` of a function with a
  `no_diff [const] groupshared` param, which emitted invalid SPIR-V/CUDA) on master in 4 variants, with SPIR-V
  validation and COMPARE_COMPUTE on vk and cuda. Every variant is now rejected at check time with E38038 ("cannot
  be differentiated, because parameter 'a' is passed by reference"): #11709 changed the policy to reject reference
  params on differentiated functions. Coverage: `tests/diagnostics/reference-param/differentiable.slang`
  (`constGroupSharedParam` :81, `noDiffGroupShared` :93). The two commits are obsolete; they stay on
  `archive/fix-issue-10641-unmerged-2026-11-11` in the fixer's base clone. Worktree `wt-slang-10641` and the
  sentinel are removed. No issue filed.

## Follow-up issues (none needs a dispatch)

| Issue | What | Treatment |
|---|---|---|
| #14094 | `__getAddress` of a field: `getValidTypeForAddressOf` gives every `MemberExpr` `Device`/`ReadWrite` regardless of its base | jhelferty-nv self-assigned (10-30). 11-04 (comment 6639387851): "Per Tess, this should be solved by making QualType go away (switch to ExprInfo)". Held, rung 4 |
| #14350 | Canonical IR set order depends on the C++ compiler that built slangc: `IRBuilder::getSet` sorts on `getUniqueID`, which assigns IDs lazily inside the `std::sort` comparator. `groupshared-param/dynamic-dispatch.slang` hit it and uses `CHECK-DAG` | jhelferty-nv filed and self-assigned 11-05 (14 s). Held under rung 4 until 11-11, when she asked the bot to triage; now its own chain: [14350 record](14350-canonical-ir-set-order-getuniqueid.md) |
| #14105 | Consolidate parameter-passing-mode modifier validation with the effective-mode computation | Bot-filed 10-30 at tangent-vector's request; no bot chain owns it. If its `issue_opened` arrives, this is the record |
| #13747–#13749, #13831–#13833 | Her #13406 follow-ups (dead-code removal, `[noRefInline]` HLSL `inout`, `QualType` → `ExprInfo`, entry-point modes, read-only borrow) | Hers; see the review-rounds file |

## Design background (09-30)

tangent-vector set the direction on #13339
([5916124244](https://github.com/shader-slang/slang/issues/13339#issuecomment-5916124244)): `const` on a parameter
is a binding modifier, and `__ref` is a passing mode, not a type. `ParameterPassingMode::Ref` splits into
`RefReadWrite`/`RefReadOnly`/`RefWriteOnly` (landed in #13406), which subsumes #11709's original side predicate
for read-only `groupshared` params. The rework-or-hold call belonged to the maintainers, not the operator.

## Lessons

- A re-chase timer's premise can be overtaken by another Orchestrator session (on 10-13 the dashboard session
  handled #13570's merge and the #13406 master merge three days before the timer fired). Before acting on a
  timer, read the head's commit log and find which session pushed it; don't redo the work.
- `ncl sessions list --limit 2000` can truncate away an old owner (created 08-05). Look up a known owner with
  `ncl sessions get <sid>`, and confirm a reply landed with `ncl sessions messages <owner> --reverse --limit 3`.
- An SDK budget exhaustion can leave cost-cap at `escalated`, never `stopped`, so a `stopped`-gated watcher never
  fires. The 10-09 incident, including the D1 cross-thread phantom session, is in the review-rounds file.
- Re-check a thread's state live before carrying it into a dispatch note or a timer: one note called the A/B
  question open a day after it was answered, and the fixer caught it.
