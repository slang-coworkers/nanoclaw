---
type: chain
title: slang PR #11709 — groupshared parameters by reference (fix for #10641)
description: Held on tangent-vector's answer to "who implements the ParameterPassingMode Ref split". Owned by slang-fixer; maintainers jhelferty-nv (CHANGES_REQUESTED) and tangent-vector (design direction via #13339)
tags: [slang, frontend, param-passing-mode, groupshared, parked]
resource: /workspace/inbox/a2a-1790792233298-nk2r5w/11709-vs-13339-plan-report.md
---

# slang PR #11709: groupshared parameters by reference

Owner: `slang-fixer`, session `sess-1785902924001-jylfb4`, thread `gh-issue-shader-slang/slang-11709`.
As of 2026-09-30 the head is `cddb935c48`. It is not a draft and is CHANGES_REQUESTED by jhelferty-nv
(review 5354344993). The companion issue [#13339](https://github.com/shader-slang/slang/issues/13339)
(a `const __ref` interface-conformance gap) was filed by slang-fixer.

## State (2026-09-30)

- **Design direction from the maintainers.** tangent-vector wrote two comments on #13339
  ([5916124244](https://github.com/shader-slang/slang/issues/13339#issuecomment-5916124244) and
  [5916469853](https://github.com/shader-slang/slang/issues/13339#issuecomment-5916469853)). Their points:
  - `const` on a parameter is a binding modifier.
  - `__ref` is a passing mode, not a type.
  - Near term, split `ParameterPassingMode::Ref` into `RefReadWrite`, `RefReadOnly` and `RefWriteOnly`.
  - `const` + `__ref` → `RefReadOnly`. For `const groupshared` → `RefReadOnly` they wrote "I'm guessing".
  - Their own open PR **#13232** ("Record effective this parameter information", 47 files) touches the same code.
- **Effect on #11709.** Commit 84fa791 compares read-only-ness as a side predicate, and only for
  `groupshared` params (`slang-check-decl.cpp:5437-5445`). The split would subsume that comparison.
  - The rework is about 100–150 lines across ~10 files, and it conflicts directly with #13232.
  - The `groupshared`-vs-`__ref` half of 84fa791 is not covered by the plan and is still an open question.
- **Round-3 peer review (`cddb935`, 2026-09-30): REQUEST_CHANGES, one 🔴 regression against master.**
  The trigger is `fwd_diff`/`bwd_diff` on a function with a `no_diff [const] groupshared float a[4]` parameter.
  The result fails spirv-val with "OpLoad Pointer … is not a logical pointer", and CUDA emits `(**&s_0)[_S1]`.
  Near-master `55e3dbdd7` compiles it cleanly.
  - slang-fixer reproduced it; I did not.
  - The reviewer's candidate producers are unverified: `populateParams` has no `RefParamType` branch, and the
    bwd `Ref`→by-value mappings.
  - Both overlap #13232.
  - Decision (me, 09-30): option (a). Root-cause it at the producer, prepare the fix and test **unpushed**,
    post one verified disclosure on #11709, and run a delta-only review when the hold lifts.
  - **Done 09-30 20:18Z.** The verified producers were `populateParams` (it had no `RefParamType` branch, so fwd
    lowers the argument as an r-value load) and the PR's own bwd `Ref`→by-value `no_diff T` mapping.
    - Local commits, **unpushed**: `9230f147c1` (fix + `tests/autodiff/groupshared-param-no-diff-direct-diff.slang`)
      and `50c003155a` (nits).
    - Full suite 7185/7187 (2 known env failures).
    - Disclosure: [5918943205](https://github.com/shader-slang/slang/pull/11709#issuecomment-5918943205).
    - When the hold lifts: push, then slang-reviewer does a delta-only review.
    - Not an issue: the whole-array load and bwd checkpoint are valid but copy-heavy (master ICEs here, so
      there's no baseline). They go in the PR description as a known limitation.
- **Q1 answered 2026-10-01 13:45Z** by jhelferty-nv ([5932748637](https://github.com/shader-slang/slang/issues/13339#issuecomment-5932748637)).
  Her answers: implement the split **on #13339** ("see how wide the blast radius gets"), and `const groupshared` maps to `RefReadOnly`.
  - slang-fixer pushed `fix/issue-13339-ref-access-modes` at `7131985de3`: 3 commits on master `3e98d9563f`,
    21 files, +344/−48 including tests.
  - Draft-PR creation is blocked by its own PLAN_REVIEW. Codex holds R5: on master, `const groupshared` has
    nothing to map, because `getExplicitlyDeclaredParamPassingMode` has no groupshared branch.
    That mapping belongs to #11709 once it rebases.
  - Decision (me, 10-01): post one verified #13339 comment giving her the blast radius she asked for, stating
    that scoping fact, and asking her to confirm the split. Opening the draft through the operator to get
    around the gate is **rejected**.
  - #11709 now stays held until the #13339 PR lands. Then it does one rebase-and-rework push that includes
    the P1 fix, followed by one delta review.
  - The rework, per the fixer:
    - drop the `isReadOnlyGroupSharedParam` matching and lowering in favor of the mode;
    - take `IRBuilder::getRefParamType(…, access, …)` and `ParameterDirectionInfo.accessQualifier`;
    - keep `HLSLGroupSharedModifier` in the synthesis clone list;
    - add `const groupshared`/`groupshared` matching tests in both directions;
    - rebase over `transposeDirection`'s Ref case.
    - **Test expectation flips.** `tests/diagnostics/groupshared-param-requirement-qualifiers.slang`
      accepts `ReadsOnly : ISharedWrite`, where a `const groupshared` method meets a `groupshared` requirement.
      This is the "asks for less" rule. Under the plan's exact mode match it becomes E38108. (Verified at
      `cddb935c48`; disclosed to jhelferty-nv in [5934711587](https://github.com/shader-slang/slang/issues/13339#issuecomment-5934711587).)
- **Decision routing.** The rework-or-hold call belongs to tangent-vector, not the operator.
  slang-fixer's #13339 reply asks them (1) who implements the split: #13339, #11709, or after #13232;
  and (2) whether `const groupshared` should map to `RefReadOnly`.
  I verified the reply's claims at master `4c88395ea0`; it was posted 2026-09-30 18:25Z as [5917220651](https://github.com/shader-slang/slang/issues/13339#issuecomment-5917220651).

## Open maintainer items

| Item | State |
|---|---|
| who implements the split / `const groupshared` mapping | **answered** 10-01 by jhelferty-nv: on #13339; yes `RefReadOnly` |
| confirm the `const groupshared` mapping lands with #11709 (not #13339) | **answered** 10-02 by jhelferty-nv ([5957659185](https://github.com/shader-slang/slang/issues/13339#issuecomment-5957659185)): "for now keep the `const groupshared` change in #11709". Draft **#13406** opened 10-02 17:46Z (head `66523f1b33`, `pr: breaking change`, Fixes #13339, CLA success, mapped to slang-fixer); 5-bullet posted [5958125514](https://github.com/shader-slang/slang/issues/13339#issuecomment-5958125514) |
| [r4141296596](https://github.com/shader-slang/slang/pull/11709#discussion_r4141296596): release assert (a)/(b) for pre-PR `.slang-module`s | open |
| [r4139502685](https://github.com/shader-slang/slang/pull/11709#discussion_r4139502685): E30709 warning vs error | open |
| jhelferty-nv CHANGES_REQUESTED | sticky until she re-reviews |
| `__constref groupshared` A/B (r4137802265) | **closed**: "(A)" at r4138118657, implemented in `c18511b5ef` (E30712) |

**#13406 review (2026-10-02).** tangent-vector left 8 inline comments on `66523f1b33`, then APPROVED (review 5395294814,
18:24Z). **The approval was auto-dismissed at 18:49:15Z**: the fixer's push of `8a979c9067` triggered stale-review
dismissal, so `reviewDecision` is now empty. The fixer's report still said "approved", and I corrected it.
- Six of the comments are fixed in code; head is now `794728a954`.
- He is sharply critical of the bot rewording his doc comment ("Please revert your incorrect change"). It was reverted
  byte-for-byte.
- Still open with him: split `RefParam<T,A>` into separate types? (r4168522180, "a subtle policy decision being made very
  lightly"). Re-approval at the current head is also needed.
- Every further push will dismiss a re-approval again, so the fixer should batch changes into one push.
- **Held batch (10-02 20:29Z):** 4 local commits on `794728a954`, ending at `0702c3ff3d`.
  - They fix slang-reviewer's must-fix: user-written `RefParam<float,(Access)7>` hit E99997, where master gives E39999.
  - A new diagnostic, E30032, rejects any invalid constant access. A generic, non-constant `A` still falls back to read-write.
  - slang-reviewer re-verified the batch from patches: APPROVE_WITH_NITS, suite 7415/7416.
  - Both facts are in front of tangent-vector at [r4169516769](https://github.com/shader-slang/slang/pull/13406#discussion_r4169516769)
    (no ping, no recommendation). One push follows his answer on the split.

Re-chase: `rechase-13406-11709-e638` (2026-10-06 09:00Z), which covers #13406 CI and review, the ready-flip decision, and the three
open #11709 items. The old `rechase-11709-constref-d-9d86` fired on 10-02 and is gone. **The #11709 hold lifts when #13406 merges.**

## Lessons

- My dispatch note said the A/B question was open when it had been answered a day earlier. The fixer
  caught it. Re-check a thread's state live before carrying it forward in a note or a timer.
