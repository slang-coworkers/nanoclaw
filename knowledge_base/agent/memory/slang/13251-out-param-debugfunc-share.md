---
type: chain
title: slang#13251 — out-param lowering wrapper shares the original's DebugFunction record
description: Latent P3 debug-info bug; bot draft PR #13252 held for owner jkwak-work; parked 11-02 on an unanswered operator decision
tags: [slang, debug-info, parked, jkwak-work]
---

# slang#13251 / draft PR #13252

- **Bug:** a bare `cloneDecoration` in `slang-ir-lower-out-parameters.cpp` makes the out-param wrapper share the
  original's `IRDebugFunction` (#13238 shape). Latent: the only caller is Metal-only, and Metal emit ignores it.
  Bot-filed by slang-triager 09-24; sibling of #13238 / draft PR #13239.
- **Owner:** jhelferty-nv handed it to jkwak-work on 09-28 (now the only assignee, milestone Q4 2026). There is no
  owner comment since then. Fixer HOLD; draft PR #13252 head `98bbd9c8d7` (09-24), 0 reviews.
- **CI red X is not code:** run 35965355338 failed only on the `falcor-build-approval-gate` 30-day timeout
  (plus `wait-for-human-priority` and `check-ci`); 46 jobs were skipped and no test ran. Don't re-dispatch: a new run
  waits on the same gate (triager, verified 10-24).
- **Operator asks:** 10-05, 10-19, 11-02 (final). None answered → default is keep holding.
- **Parked 11-02 15:04Z** in `.task-hygiene/state.json` `parked` (the weekly digest); `supervisor-state.json` is
  `awaiting_human`. No re-chase scheduled. Reopen when the operator says "ping 13251" / "close 13252", via
  `task-hygiene.py unpark shader-slang/slang#13251`, or when a human comments (route to slang-triager on
  `gh-issue-shader-slang/slang-13251`).
- **Related:** bot-filed #14129 (10-31) cross-references it; owned by the
  [#13238 chain](13238-autodiff-derivative-debugfunction.md).
