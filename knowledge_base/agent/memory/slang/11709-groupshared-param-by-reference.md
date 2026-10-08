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

- **10-05 19:57Z: jhelferty-nv marked #13406 ready** and requested dshreiner-nv; the operator ready-flip ask is moot. tangent-vector
  still hadn't answered r4168522180, and the head was still `794728a954`, which has the known E99997 bug. With no approval
  left to dismiss and a new reviewer about to read the head, I told the fixer to push the held batch now and leave the split question open.
  - **Pushed 10-05 ~21:07Z**: head `0adba88fd1`. The 4 commits `1a449c7e21`, `0c9f9a7c32`, `df1c38ce4d` and `0adba88fd1` are all App identity `274397474`.
    The fix shas are listed in the reply [r4188816911](https://github.com/shader-slang/slang/pull/13406#discussion_r4188816911), which pings no one. The split question
    r4168522180 is still open with tangent-vector.

- **10-05 21:58Z:** jhelferty-nv asked for the new diagnostic to be renumbered, because its number collided with one on master. The fixer merged master `d307206deb`
  and moved E30032 to **E30034**. Head is now `a1286c3415`.
- **Re-chase `rechase-13406-11709-e638` fired 2026-10-06 09:00Z (the only automated round).** Nothing is merged and nobody was pinged. Sent the operator one table.
  - dshreiner-nv was requested at 19:57:40Z, and jhelferty-nv removed the request 28 s later, so jhelferty-nv is the only requested reviewer.
  - tangent-vector has posted no review at this head and has been silent since 10-02 18:17Z. r4168522180 is still unanswered.
  - CI on the head is all green. `falcor-build-approval-gate` is waiting on a maintainer. The bot also dispatched a run where `check-ci` failed, but only because
    `wait-for-human-priority` failed and every job was skipped.
  - The three #11709 items are unchanged: r4141296596 and r4139502685 are unresolved with no maintainer reply, and review 5354344993 still requests changes.
  - ~~No timer remains.~~ Replaced by `rechase-13406-r2-9164` (2026-10-09 09:00Z). It notices the #13406 merge, lifts the #11709 hold through slang-fixer, and otherwise sends the operator one table.
- **10-06 16:51/17:17Z: jhelferty-nv CHANGES_REQUESTED** (review 5431819390, at `a1286c3415`).
  - [r4198094764](https://github.com/shader-slang/slang/pull/13406#discussion_r4198094764): `readonly` + `__ref` must also derive
    `RefReadOnly`. That needs a new declaration-level `ReadOnlyModifier`, separate from `GLSLReadOnlyModifier`; checking decides
    which one applies once the type is known. `const __ref` keeps working as the legacy spelling.
  - [r4198335992](https://github.com/shader-slang/slang/pull/13406#discussion_r4198335992): witness synthesis should add
    `ReadOnlyModifier` instead of `ConstModifier`.
  - The fixer is planning R6/R7. I checked its summary against her text and it's faithful.
  - **#11709 rebase impact (open):** with `readonly` as the canonical spelling, `readonly groupshared` → `RefReadOnly` is probably
    needed alongside `const groupshared`. Ask her when #11709 rebases; don't assume it.
  - **R6/R7 pushed 10-06 ~20:57Z**: head `0843d66c6b`, App identity. Replies [r4200350398](https://github.com/shader-slang/slang/pull/13406#discussion_r4200350398) and [r4200350749](https://github.com/shader-slang/slang/pull/13406#discussion_r4200350749), no pings.
    Both parity checks match master: `readonly image2D` gives byte-identical `NonWritable`, and `readonly uint` without `__ref` still gives E31206.
    Her CHANGES_REQUESTED stands until she re-reviews.
  - **10-06 21:53Z, waiting on her design choice.** In [r4200385314](https://github.com/shader-slang/slang/pull/13406#discussion_r4200385314)/[r4200510268](https://github.com/shader-slang/slang/pull/13406#discussion_r4200510268) she asked whether to parse as
    `ReadOnlyModifier` first, or as `UncheckedReadOnlyModifier` resolved later.
    - The bot replied in [r4200803328](https://github.com/shader-slang/slang/pull/13406#discussion_r4200803328), with no pings. It disclosed that `0843d66c6b` keeps master's early GLSL fold, which is *not* the fully
      deferred classification she asked for, and asked which ordering she prefers.
    - Her answer goes in one batched push.
  - **10-07 00:19Z she chose "parse as `ReadOnlyModifier` first"** ([r4201706513](https://github.com/shader-slang/slang/pull/13406#discussion_r4201706513)). Pushed ~01:49Z: head `d47ae5627d`, App identity.
    The `checkModifiers`/`visitParamDecl` paths turn it into the GLSL form on images, buffers and non-`__ref` declarations. Every unchanged path matches master byte for byte.
    Her CHANGES_REQUESTED still stands; she needs to re-review at `d47ae5627d`.
  - **10-07 22:45Z: master merged, as jhelferty-nv asked at 21:16Z.** Merge `33c55b8cd4` and test commit `e77f209309`, App identity, no force-push, MERGEABLE.
    #13232 had **landed on master** and caused all 7 conflicts. Master's code was kept, and the Ref split now lives in its shared helpers.
    One behavior fix: after #13232, a `readonly __ref` declaration paired with a `__ref` definition hit E39999. It is pinned by a test, and a revert drill confirmed the test fails without the fix.
    Her CHANGES_REQUESTED still stands.

## Lessons

- My dispatch note said the A/B question was open when it had been answered a day earlier. The fixer
  caught it. Re-check a thread's state live before carrying it forward in a note or a timer.
