---
type: chain
title: slang#13220 — CUDA interface dispatch default arm, draft PR #13228
description: Held draft, operator a/b/c ask pending since 10-14. kaizhangNV accepts the s_dispatch_* fix; the open question is what force-unwrapping a `none` Optional<Interface> should do (undefined / must trap / must return a value)
tags: [slang, cuda, perf, dynamic-dispatch, parked]
---

# slang#13220: CUDA interface dispatch default arm (draft PR #13228)

Owner `slang-fixer`, session `sess-1790092897972-cuygfq`, thread `gh-issue-shader-slang/slang-13220`,
branch `fix/issue-13220`. Head `842ea5d5c1`, held draft. Reporter tdavidovicNV (member).

## What the PR does

`createDispatchFunc` (`slang-ir-lower-dynamic-dispatch-insts.cpp`) emits `unreachable` on the
witness-tag switch's default arm instead of a default-constructed return. The C-like emitter
renders it as `SLANG_PRELUDE_UNREACHABLE()`. The target gate is
`doesTargetSupportUnreachableTerminator`: CUDA and C++-source CPU are in; HostVM, CSource and
CPU-via-LLVM are out. `createIntegerMappingFunc` is deliberately unchanged, because its default
is the in-set clamp that keeps the dispatch default dead.

## The open question

Force-unwrapping a `none` `Optional<Interface>` (`opt.value` without a `hasValue` check) lowers
through `GetTagForSubSet`, which is a plain cast with no clamp. So the `none` tag reaches the
default arm.

- Before the PR the call returned 0, and HLSL still does.
- After the PR it traps by default (`__trap()`, `trap;` in PTX), because Slang never defines
  `NDEBUG`.
- With `-DNDEBUG` it becomes `__builtin_unreachable()` (`__assume(0)` on MSVC), which is UB.
- The perf win does not depend on `NDEBUG`. The repro PTX is identical either way.

kaizhangNV asked on 10-05 ([6002151425](https://github.com/shader-slang/slang/pull/13228#issuecomment-6002151425)).
The fixer replied with three answers ([6002744164](https://github.com/shader-slang/slang/pull/13228#issuecomment-6002744164)):

1. Undefined → the PR is done.
2. Must trap → add a trap that does not depend on `NDEBUG`.
3. Must return a value → narrow the optimization where a sub-set cast feeds the dispatcher. A
   clamp would pick a conformer, which is its own policy question.

## Re-chase log

- 2026-10-08 (`rechase-13228-kaizhang-a0d7`): no reply. Checked PR comments, reviews, inline
  comments and #13220. Posted the hold to the dashboard and did not ping the maintainer.
- 2026-10-11 (`rechase-13228-kaizhang-2-93a4`): no reply. Same surfaces checked, plus the
  timeline; the last event is still the 10-05 20:55Z bot comment. Posted the hold to the
  dashboard (msg 9) and did not ping.
- 2026-10-14 (`rechase-13228-kaizhang-3-6a59`): no reply, the third silent window (9 days).
  Same surfaces checked, PR still a draft at `842ea5d5c1`. Escalated to the operator on the
  dashboard (msg 9, thread `gh-issue-shader-slang/slang-13220`) with three options: (a) keep
  waiting, (b) the fixer posts one polite follow-up @kaizhangNV, or (c) default to option 1
  (undefined) and mark ready. Did not ping the maintainer.
- 2026-10-17 (`rechase-13228-kaizhang-4-4638`): no maintainer reply (12 days) and no operator
  answer. All the GitHub surfaces were checked. The only new timeline event is a 10-16 bot
  cross-reference from #13691 (`assume`/`expect` intrinsics feature request), which is not a reply.
  On the dashboard I paged from seq 501650 (the 10-14 ask is row 501656) to 505704 and found no
  a/b/c answer. Re-asked a/b/c on the dashboard (msg 45). Nothing sent to the fixer, no ping.
- Next: `rechase-13228-kaizhang-5-aa9c`, 2026-10-20 21:00Z, with the same decision table.
- 2026-10-20: `rechase-13228-kaizhang-5-aa9c` **never fired**. Its session `sess-1792271016951-vul4g0`
  has only the task row (seq 2) and is closed with no output, so the chain went 6 days with no timer.
  Check that each re-chase actually ran (`ncl sessions messages <task session>`), not just that one exists.
- 2026-10-23: the fixer reported that run 35810600017 (dispatched 09-23) failed. This is not a code
  failure: `wait-for-human-priority` yielded, `check-ci` followed it, and `falcor-build-approval-gate`
  expired after 30 days waiting for `falcor-ci` approval. The other 46 jobs were skipped, so the PR has
  no build/test signal yet. GitHub refuses a rerun after one month.
  `retry-yielded-bot-ci` reruns only completed runs younger than 16 h
  (`extras/ci/retry-yielded-bot-ci.py:57`, `:122-134`), so a run held open by the Falcor gate is
  never retried. The branch is 171 commits behind master; the fixer will merge master and dispatch CI
  after the decision.
  At 18 days with no maintainer reply and 9 with no operator a/b/c answer, I stopped the 72 h
  re-chases. As with #13424, webhooks drive the chain now, plus one passive one-shot,
  `passive-13228-d25-43d6` (2026-10-30T21:00Z), which makes no asks and does not reschedule.
  A kaizhangNV comment reaches the fixer directly through the PR mapping.
  It pages the dashboard with `--since-seq 505700`. A one-shot can't be `ncl tasks update`d
  while it is firing ("no live task matched"), so each re-chase is created as a new task.
- 2026-10-30 (`passive-13228-d25-43d6`): no change. No human comment/review on #13228/#13220 after 10-23 02:40Z; PR still OPEN draft at `842ea5d5c1` (updatedAt 10-05). Dashboard seq 507557→509502 (to 10-30 20:30Z): no a/b/c answer. Sent nothing, not rescheduled — webhooks only now. (Page with Python `json.loads`, not `jq`: one page has a bad surrogate escape jq rejects.)
- Dashboard paging: `--reverse --limit 400` only reaches back about 2 days on this busy session.
  To cover the window since the ask, walk forward with `--since-seq <seq near the ask>`.

## Lessons

- The closed-set gate cleared once (round 1) and then reopened in round 2. The round-1 trace only
  enumerated the tag producers it already knew about. A soundness gate needs a search for every
  producer of the tag type (`GetTagForSubSet` was missed), not a check of the familiar ones.
- "Release" in a prelude macro means `NDEBUG` in the downstream compile. It does not mean `-O3`,
  and Slang never sets it. Check what a build mode means before telling a maintainer about UB.
