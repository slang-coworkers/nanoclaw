---
type: chain
title: slang PR #13406 (#13339 Ref split) — review-round history, 2026-10-01 → 10-09
description: Condensed history of the ParameterPassingMode Ref-split PR #13406 that #11709 is held on — tangent-vector's and jhelferty-nv's review rounds, the readonly design reversal, and the 10-09 owner-budget/phantom-session incident. Settled history; live state is in [[slang/11709-groupshared-param-by-reference.md]].
tags: [slang, frontend, param-passing-mode, history]
---

# PR #13406 (#13339 Ref split): review-round history

Split out of [[slang/11709-groupshared-param-by-reference.md]] by okf-synthesis on 2026-10-09. The **live** state
(head, owner session, timer) is in the parent; this file records how the design converged.

## Opening (10-01 → 10-02)

- slang-fixer pushed `fix/issue-13339-ref-access-modes` at `7131985de3` (3 commits on master `3e98d9563f`, 21 files,
  +344/−48). Its own PLAN_REVIEW blocked draft-PR creation. Codex held R5: on master, `const groupshared` has nothing
  to map. I rejected opening the draft through the operator to get around that gate. Instead, one verified #13339
  comment gave her the blast radius she asked for.
- Draft **#13406** opened 10-02 17:46Z (head `66523f1b33`, `pr: breaking change`, Fixes #13339), mapped to
  slang-fixer. 5-bullet: [5958125514](https://github.com/shader-slang/slang/issues/13339#issuecomment-5958125514).

## tangent-vector round (10-02)

- 8 inline comments on `66523f1b33`, then APPROVED (review 5395294814, 18:24Z). **The approval was auto-dismissed at
  18:49:15Z** when the fixer pushed `8a979c9067`. The fixer's report still said "approved", and I corrected it.
- He was sharply critical of the bot rewording his doc comment ("Please revert your incorrect change"). It was
  reverted byte-for-byte.
- His open question on splitting `RefParam<T,A>` into separate types (r4168522180, "a subtle policy decision being
  made very lightly") was never answered by him. jhelferty-nv settled it on 10-09 (A, below).
- A held batch of 4 commits (ending `0702c3ff3d`) fixed slang-reviewer's must-fix: user-written
  `RefParam<float,(Access)7>` hit E99997, where master gives E39999. The new diagnostic E30032 rejects an invalid
  constant access. Re-verified APPROVE_WITH_NITS, suite 7415/7416.
- ⇒ Every push dismisses an approval, so changes are batched into one push.

## Ready flip and renumber (10-05)

- 19:57Z jhelferty-nv marked #13406 ready and requested dshreiner-nv, then removed that request 28 s later. No
  approval was left to dismiss, and the head still had the E99997 bug. So I told the fixer to push the held batch:
  head `0adba88fd1` (~21:07Z), reply [r4188816911](https://github.com/shader-slang/slang/pull/13406#discussion_r4188816911), no pings.
- 21:58Z she asked for a renumber, because the diagnostic collided with one on master. Merged master `d307206deb`,
  E30032 → **E30034**, head `a1286c3415`.
- The 10-06 09:00Z re-chase: CI all green, `falcor-build-approval-gate` waiting on a maintainer. A bot `check-ci`
  failure was only `wait-for-human-priority` skipping every job.

## jhelferty-nv `readonly` rounds (10-06 → 10-07)

- 10-06 CHANGES_REQUESTED (5431819390): `readonly` + `__ref` must derive `RefReadOnly` via a new declaration-level
  `ReadOnlyModifier` ([r4198094764](https://github.com/shader-slang/slang/pull/13406#discussion_r4198094764)), and
  witness synthesis should add `ReadOnlyModifier`, not `ConstModifier`
  ([r4198335992](https://github.com/shader-slang/slang/pull/13406#discussion_r4198335992)). R6/R7 pushed at
  `0843d66c6b`. Parity with master: `readonly image2D` gives byte-identical `NonWritable`.
- Ordering question (parse as `ReadOnlyModifier` first, or as `UncheckedReadOnlyModifier` resolved later). The bot
  disclosed that `0843d66c6b` kept master's early GLSL fold. She chose "parse first" on 10-07 00:19Z
  ([r4201706513](https://github.com/shader-slang/slang/pull/13406#discussion_r4201706513)), pushed as `d47ae5627d`.
- 10-07 22:45Z: master merged at her request (`33c55b8cd4` + test `e77f209309`, no force-push). **#13232 had landed
  on master** and caused all 7 conflicts. Master's code was kept, and the split now lives in its shared helpers.
  A `readonly __ref` declaration paired with a `__ref` definition hit E39999. The fix is pinned by a test, and a
  revert drill confirmed the test fails without it.

## The reversal (10-08 → 10-09)

- 10-08 22:10Z (review 5463447838, at `797b7e096f`): `readonly`/`writeonly` stay GLSL memory qualifiers.
  - New keywords `__ref_readonly`/`__ref_writeonly`. `const __ref` is rewritten to `RefModifier` + `ReadOnlyModifier`.
  - The `d47ae5627d` reclassify pass is deleted.
  - The three modes stay distinct in overload matching, so the e77f209 test is deleted.
  - Reading through `__ref_writeonly` is an error ([6070683551](https://github.com/shader-slang/slang/pull/13406#issuecomment-6070683551)).
- Implemented locally on 10-09 01:13Z (5 commits `8a59955b4f`…`fcb2834e14`, suite 7740/7742), waiting on
  [6070871935](https://github.com/shader-slang/slang/pull/13406#issuecomment-6070871935) (A/B for `RefWriteOnly`) and
  [6072225296](https://github.com/shader-slang/slang/pull/13406#issuecomment-6072225296). Master mangles every Ref as
  `r_` (`slang-mangle.cpp:137`), so `__ref` and `__ref_readonly` witnesses collided. E30119 covered only initializers
  and assignment right-hand sides.
- **10-09 02:33Z answers (review 5465076473)**:
  - **A:** append `Access.WriteOnly = 3`, used only as `RefParam`'s access. There are no separate param types.
    Reject `Ptr`/`Ref<T, Access.WriteOnly>`, and give the `QualType` switch an explicit `WriteOnly` case.
  - Mangling: `r_`/`ro_`/`wo_`, and existing `__ref` stays `r_`.
  - Every value read of `__ref_writeonly` is E30119, checked in `coerce()`. Binding as a location is fine, but a
    by-ref builtin like `+=` needs its own check.

## Owner budget and phantom session (10-09)

- The owner `jylfb4` ran R16–R20 in a subagent at $288/$300 and then hit the SDK limit at 03:46Z. Cost-cap still
  read `escalated`, never `stopped`, so the gated watcher `watch-13406-owner-stop-bd01` (`tools/gate-jylfb4-stopped.sh`)
  could never fire. I cancelled it. At that point there were 7 clean local commits on `797b7e096f` (the last two
  `d2891fd3ca` A/E30035 and `4c7b17dcf2` E30119), and the work resumed in `dth1ak` (see the parent).
- Phantom `sess-1791471057196-2ouns9` (thread `…-12122`) was minted on 10-08 14:50:57Z by my `in_reply_to` reply.
  The owner stamps its reports `…-12122` but lives on `…-11709`. The D1 guard rejected the reply and the
  fall-through created the new session. The phantom called the reversal "lost" and started redoing it, then stood
  down with no edits or posts. Its advisory (`reports/slang-13339-r3/advisory-from-12122-session.md`) was forwarded
  pinned to `jylfb4` (msg 2207, seq 344). Its #13445 claim checked out: the module version went 33 → 34.

## 2026-10-09 14:06Z: jhelferty-nv answered the r5 questions (review 5471154778, COMMENTED, at `4e2603652e`)

- What she said: the write-only read check keys off `Access.WriteOnly` on the `RefParam`. GLSL `writeonly` goes back to master's E30119 behaviour (initializer and assignment RHS only), and the new E30119 on `b.d[0] + 1` is reverted. `__ref_writeonly` → `inout` is E30119. Keep E30035. Only `out` and `__ref_writeonly` count as a location. Passing to a parameter that drops a restriction is rejected in both directions, and `__ref` may go to either restricted mode. The `t.Load()` gap is accepted.
- The review reached the **old** session `jylfb4` ($297.72 of $300) because the #13406 PR mapping still points there (remap `appr-…iwgn54` has been pending since 03:50Z). That session saved her text and stopped without pushing, and asked to keep one owner.
- 14:12Z: I dispatched her text verbatim to the resume session `dth1ak`, pinned on `…-11709/13406-resume` (msg 2339, which landed as its inbound seq 16). It goes in one push together with slang-reviewer's round-2 items. I did not reply to `jylfb4`.
- `rechase-13406-r5-qs-7621` (10-11) is now case (b), dispatched. It checks for that push.
- 15:24Z: jhelferty-nv asked "poke, any update?" (issuecomment-6083909671). The webhook again reached `jylfb4`, because the remap is still pending. Its only action was a status reply, issuecomment-6083935283, which I checked as accurate: head still `4e2603652e`, one push coming. It then stood down without touching the worktree. Its ceiling is now **$400**, raised by someone other than me, and it has spent $300.10, so it keeps acting on misrouted webhooks. The owner `dth1ak` has been planning round 3 since 14:18Z.
- 18:15Z: tangent-vector replied (issuecomment-6086673678). "Don't rewrite things": compute the effective parameter-passing mode in one place, have every consumer query that mode, and handle `const __ref` there. He also wants "memory location" or "abstract storage location" instead of a bare "location". This conflicts with jhelferty's review 5463447838, which asks to rewrite `ConstModifier` away. The webhook went to `jylfb4` again. It posted a question to both maintainers (issuecomment-6086715387) proposing to keep the modifiers as written and map them to `RefReadOnly` at that one place, and touched no code. At 18:2xZ I forwarded his text to the owner `dth1ak` (msg 2379, pinned): hold only the `const __ref` representation, ideally as its own commit; carry on with the rest; use his terminology; make one push either way.
- 19:03Z: jhelferty-nv sided with tangent-vector (issuecomment-6087420482: "follow tangent-vector's direction for this point instead of mine"). So the conflict is settled: no `ConstModifier` rewrite, and the effective mode maps `RefModifier`+`ConstModifier`/`ReadOnlyModifier` to `RefReadOnly`. `jylfb4` acknowledged it (issuecomment-6087432321, same push). I lifted the hold on `dth1ak` (msg 2389): drop `94c546d2b8`, move the reflection, ast-print and `getTypeForDeclRef` checks onto the effective mode, keep `functionReflectionConstRefParam` passing, one push.
