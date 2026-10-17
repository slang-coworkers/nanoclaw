---
type: chain
title: slang#13565 — SemanticChecking ~7% compile-time step since 2026-10-07 (not bisected)
description: OPEN, assigned 10-12 to jvepsalainen-nv (by jkwak-work), silent. Step persists (10-15 abs geomean 1.066/54). Operator asked 10-16 about (a) bot comment / (b) bot bisect, unanswered. Re-chase rechase-13565-r4-f6d2 10-19 09:00Z
tags: [slang, perf, compile-time, regression, nightly-mdl-perf]
---

# slang#13565 — SemanticChecking compile-time step

Filed 2026-10-10 08:59Z by slang-triager, on the order of the TOT-regression-scan Main session
(`sess-1791447348887-pfjike`). Found by slang-release-regression-check. Two windows:
`d307206d..bce8cbef` (core-module growth: #12249, #13270) and `bce8cbef..d074e777` (C++
sema: #13232, #13445). Neither window is bisected.

## Ownership

- 10-12 16:32Z: jkwak-work assigned it to **jvepsalainen-nv**, who owns the compile-perf tooling.
  It's a maintainer-owned perf investigation, so **no fixer dispatch**.
- 10-15: the dashboard re-sent it as "new issue to triage". It was already triaged
  (bot-filed, so the body is the verdict). I answered on the canonical thread with nothing dispatched.

## Measurement method (re-use it, don't trust nightly green)

The nightly analyzer compares against the **trailing-7 median**. From 10-11 that window is
mostly post-step, so the step stops being flagged even though it's still there. Re-measure
from absolute medians instead: `shader-slang/slang-compile-perf` `daily/<date>-<sha>/results.json`
(a list of rows, `timers.<name>.median`, keyed by workload/mode/size), compared against
`daily/2026-10-06-d307206de`.

| date | SemanticChecking geomean (54) | up | compileInner | linkAndOptimizeIR |
|---|---|---|---|---|
| 10-08 `d074e7779` | 1.078 | 49 | 1.035 | 1.006 |
| 10-15 `f2b163c08` | 1.066 | 47 | 1.025 | 1.004 |
| 10-16 `e49310561` | 1.111 ⚠️ step-2 | 52 | 1.041 | 1.009 |

The daily geomean from 10-08 to 10-15 stays in the 1.037–1.078 band, which is ±~2% day-to-day noise on top of the step.
**10-16 is contaminated** by a second, separate step: #13537/#13626/#13615, with 10-15→10-16 SemanticChecking
1.042 and IR passes ≈0.99. The nightly flagged it (run 38855038868 failed; worst is generic_builtin_operator 1.21×).
It is tracked on dashboard thread `perf-semanticchecking-step2-1016` / one-shot `perf-semcheck-step2-conf-3085`.
Measure #13565 at the 10-15 point and caveat later dailies.

## Bisect parameters (if the operator authorizes)

`nightly-mdl-perf-test.yml` workflow_dispatch: `ref=<full 40-char SHA>` (short SHAs fail checkout),
`suite-ref=master` (old commits' own tools/compile-perf won't accept current args), `publish=false`,
`only=conformance,implicit_conversion,overload_resolution,sema_generics,mdl_dxr`. Concurrency group
never cancels, so runs queue. The 10-07 subset jump came mostly from conformance/implicit_conversion (+6%); on 10-08
every subset workload rose.
- W1: 5cb03fa5f71f5b9c368df82ac17b616763912251, c8e02397a7f7556c3ea42c4333750bf8a3ddee33,
  98c4f258c6a147bfc420c71b2d8b0a45cdd5619f (#13270), ef7e6dcf1deab0cc76e6b2cdf1fb4580eb17e5b0
- W2: 93a54974c17fc24f6d9b539ec8daa2cf734bce4a, 649a6f83bd368e0f38c0b276311b47073f62dd4c (#13232),
  2dcbe6c7a489f8234aa09d508a68a5bafe28d4b9, e2e217dd24fc661388ebf8fd7c28a4c5b8c2bf5b (#13445)

10-15 per-workload: conformance 1.092, implicit_conversion 1.093, overload_resolution 1.062,
sema_generics 1.016, mdl_dxr 1.042, minimal 1.089.

## Non-bisect dispatches (don't count them as a started bisect)

- Run 38708636360 (10-15 08:51Z, jvepsalainen-nv): `workflow_dispatch` on `test/benchview-upload`
  @`40d292c0e`, "Test BenchView upload with archived nightly results". This is tooling work.
- Run 38751675993 (10-15 14:28Z, `test/benchview-release-pilot` @`100d0bb02`, cancelled) and
  run 38875875378 (10-16 08:45Z, `test/benchview-host-export-20261016` @`8c8b27e04`, cancelled) are also BenchView tooling.
  **Every `test/benchview-*` branch is tooling.**

## Timeline

- 10-10: filed; re-chase `rechase-13565-semcheck-p-4f67` (fired 10-13).
- 10-13: [Update] sent to the dashboard (owned, silent); re-chase `rechase-13565-assignee-p-067f`
  set for 10-16 09:00Z. If still silent, it asks the operator about (a) a persistence comment and/or
  (b) a bot bisect, which needs operator authorization for the shared perf runner.
- 10-15 11:40Z: re-measured (table above); task prompt updated with the method and the non-bisect run.
- 10-16 09:05Z: still silent and unbisected. Sent the [Update] to the dashboard (msg 9, thread `gh-issue-shader-slang/slang-13565`)
  asking about (a) a persistence comment and (b) a bot bisect. **This is the 1st ask**; the 10-13 run had skipped it because an owner existed.
  Next: `rechase-13565-r4-f6d2` 10-19 09:00Z re-asks once, then switches to a +7d cadence and parks after a 3rd unanswered ask.
