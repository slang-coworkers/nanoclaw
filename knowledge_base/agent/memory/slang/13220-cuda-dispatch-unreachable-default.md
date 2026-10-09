---
type: chain
title: slang#13220 — CUDA interface dispatch default arm, draft PR #13228
description: Held draft. kaizhangNV accepts the s_dispatch_* fix; the open question is what force-unwrapping a `none` Optional<Interface> should do (undefined / must trap / must return a value)
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
- Next: `rechase-13228-kaizhang-2-93a4`, 2026-10-11 21:00Z. A one-shot can't be
  `ncl tasks update`d while it is firing ("no live task matched"), so the next re-chase is
  created as a new task.

## Lessons

- The closed-set gate cleared once (round 1) and then reopened in round 2. The round-1 trace only
  enumerated the tag producers it already knew about. A soundness gate needs a search for every
  producer of the tag type (`GetTagForSubSet` was missed), not a check of the familiar ones.
- "Release" in a prelude macro means `NDEBUG` in the downstream compile. It does not mean `-O3`,
  and Slang never sets it. Check what a build mode means before telling a maintainer about UB.
