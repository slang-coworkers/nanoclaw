---
type: chain
title: slang PR #11709 — groupshared parameters by reference (fix for #10641)
description: HELD until #13406 (the #13339 ParameterPassingMode Ref split) lands; then one rebase-and-rework push carrying the unpushed P1 autodiff fix, then a delta review. Owned by slang-fixer; jhelferty-nv CHANGES_REQUESTED. The #13406 review rounds live in [[slang/11709-13406-ref-split-review-rounds.md]].
tags: [slang, frontend, param-passing-mode, groupshared, parked]
resource: /workspace/extra/ephemeral/prod-groups/slang-fixer/reports/comments/11709-vs-13339-plan-report.md
---

# slang PR #11709: groupshared parameters by reference

Owner: `slang-fixer`, thread `gh-issue-shader-slang/slang-11709`. The original owner session
`sess-1785902924001-jylfb4` ran out of budget on 2026-10-09 03:46Z. Head `cddb935c48` (09-30), non-draft,
CHANGES_REQUESTED by jhelferty-nv (review 5354344993). Companion issue
[#13339](https://github.com/shader-slang/slang/issues/13339) (a `const __ref` interface-conformance gap) was filed
by slang-fixer and is fixed by PR **#13406**. Older history lives in the imported leaf
[[imported/project_11709_groupshared_byref.md]].

## Current state (2026-10-09)

- **The hold.** jhelferty-nv decided on 10-01 to implement the split on #13339
  ([5932748637](https://github.com/shader-slang/slang/issues/13339#issuecomment-5932748637)). On 10-02 she said to
  keep the `const groupshared` change in #11709
  ([5957659185](https://github.com/shader-slang/slang/issues/13339#issuecomment-5957659185)). So #11709 waits
  for #13406 to merge.
- **#13406.** On 10-09 02:33Z jhelferty-nv answered every open question (review 5465076473): A
  (`Access.WriteOnly = 3`), `r_`/`ro_`/`wo_` mangling, and E30119 checked in `coerce()`. The implementation is 7 local
  commits on `797b7e096f`, ending `d2891fd3ca` + `4c7b17dcf2`, in `wt-slang-13339`.
  - The work resumed in a fresh session, `sess-1791517792695-dth1ak`, on sub-thread `…-11709/13406-resume`
    (msg 2239). It got her review verbatim and a 9-item checklist; items 1, 7 and 8 are still open (module version,
    commit order, `const` reflection).
  - `pr-mappings remap` for #13406 (`appr-1791517835370-iwgn54`) is waiting on admin approval. Both #13406 and #11709 still map to `jylfb4`.
  - **r5 PUSHED 10-09 08:49Z**, head `4e2603652e`. Verified on GitHub:
    - A fast-forward of 5 commits on `797b7e096f`, with no force-push and every commit under App identity `274397474`. The 7 local commits were rewritten into 5 before the push.
    - All checklist items are resolved: module v35, reflection `const`, commit order, and the R19 read gaps (swizzles, `switch`, receivers, the `__subscript` getter).
    - Suite 7744/7745 (gfx-smoke env), unit 629/629 (adds `irBlobRejectsVersion34`). Reply [6077629359](https://github.com/shader-slang/slang/pull/13406#issuecomment-6077629359) with no pings; explain-diff 6002932281. slang-reviewer peer review requested.
    - Five questions back to her:
      1. the GLSL `writeonly` param as a location, and `writeonly` buffer reads now E30119 where master accepted them;
      2. E30119 on `inout`;
      3. E30035 vs E30034;
      4. a write-only argument to a `__ref_readonly` param;
      5. the `t.Load()` gap.
    - Her CHANGES_REQUESTED still stands. The branch is BEHIND master, and CI is running.
- **Timer.** `rechase-13406-r2-9164` fired 10-09 09:00Z. The next one is `rechase-13406-r5-qs` (10-11 09:00Z), which watches her 5 answers and the merge, and lifts the #11709 hold
  through slang-fixer. Otherwise it sends the operator one table.

## What #11709 does when the hold lifts

1. **Push the unpushed P1 fix:** `9230f147c1` (fix + `tests/autodiff/groupshared-param-no-diff-direct-diff.slang`)
   and `50c003155a` (nits), suite 7185/7187. Disclosed in
   [5918943205](https://github.com/shader-slang/slang/pull/11709#issuecomment-5918943205).
   - The regression came from round-3 peer review at `cddb935` (09-30): REQUEST_CHANGES with one 🔴 regression
     against master. Applying `fwd_diff`/`bwd_diff` to a function with a `no_diff [const] groupshared float a[4]`
     parameter fails spirv-val ("OpLoad Pointer … is not a logical pointer"), and CUDA emits `(**&s_0)[_S1]`.
   - The verified producers: `populateParams` had no `RefParamType` branch, so fwd lowered the argument as an
     r-value load. The other was the PR's own bwd `Ref`→by-value `no_diff T` mapping.
2. **Rework onto the split modes** (the fixer's plan):
   - drop the `isReadOnlyGroupSharedParam` matching and lowering in favor of the mode;
   - use `IRBuilder::getRefParamType(…, access, …)` and `ParameterDirectionInfo.accessQualifier`;
   - keep `HLSLGroupSharedModifier` in the synthesis clone list;
   - map `const groupshared` → `RefReadOnly` here, because on master `getExplicitlyDeclaredParamPassingMode` has
     no groupshared branch;
   - add `const groupshared`/`groupshared` matching tests in both directions;
   - rebase over `transposeDirection`'s Ref case, and over #13232, which is now on master.
3. **Test expectation flips.** `tests/diagnostics/groupshared-param-requirement-qualifiers.slang` accepts
   `ReadsOnly : ISharedWrite` today: a `const groupshared` method satisfies a `groupshared` requirement because
   it asks for less. Exact mode matching turns that into E38108 (verified at `cddb935c48`, disclosed in
   [5934711587](https://github.com/shader-slang/slang/issues/13339#issuecomment-5934711587)).
4. **Ask, don't assume:** should `__ref_readonly` have a groupshared analogue? After her 10-08 reversal, `readonly`
   is GLSL-only again.
5. The PR description lists one known limitation: the whole-array load and bwd checkpoint are valid but
   copy-heavy. There is no baseline to compare against, because master ICEs here.
6. Then one delta-only slang-reviewer review.

## Open #11709 maintainer items

| Item | State |
|---|---|
| [r4141296596](https://github.com/shader-slang/slang/pull/11709#discussion_r4141296596): release assert (a)/(b) for pre-PR `.slang-module`s | open |
| [r4139502685](https://github.com/shader-slang/slang/pull/11709#discussion_r4139502685): E30709 warning vs error | open |
| jhelferty-nv CHANGES_REQUESTED (5354344993) | sticky until she re-reviews |
| `__constref groupshared` A/B (r4137802265) | **closed**: "(A)" at r4138118657, implemented in `c18511b5ef` (E30712) |

## Design background (09-30)

tangent-vector set the direction on #13339
([5916124244](https://github.com/shader-slang/slang/issues/13339#issuecomment-5916124244),
[5916469853](https://github.com/shader-slang/slang/issues/13339#issuecomment-5916469853)). `const` on a parameter is
a binding modifier, and `__ref` is a passing mode, not a type. Near term, `ParameterPassingMode::Ref` splits into
`RefReadWrite`/`RefReadOnly`/`RefWriteOnly`. #11709's commit 84fa791 compares read-only-ness as a side predicate,
and only for `groupshared` params (`slang-check-decl.cpp:5437-5445`), so the split subsumes it. The rework-or-hold
call belonged to the maintainers, not the operator.

## Lessons

- My earlier "no other session holds the reversal" was wrong. `ncl sessions list --limit 2000` truncated away the
  owner, which was created 2026-08-05. Look up a known owner with `ncl sessions get <sid>`, and check that a reply
  landed with `ncl sessions messages <owner> --reverse --limit 3`.
- An `in_reply_to` reply to a session whose reports carry a different thread than its own gets rejected by the D1
  cross-thread guard, and the fall-through mints a phantom session. Send to the owner pinned, on its own thread.
  The 10-09 incident is in the review-rounds file.
- An SDK budget exhaustion can leave cost-cap at `escalated` and never `stopped`. A watcher gated only on `stopped`
  never fires.
- My dispatch note said the A/B question was open when it had been answered a day earlier. The fixer caught it.
  Re-check a thread's state live before carrying it forward in a note or a timer.
