---
type: chain
title: slang#13565 — SemanticChecking ~7% compile-time step since 2026-10-07 (not bisected)
description: OPEN, assigned 10-12 to jvepsalainen-nv (by jkwak-work). Step persists at 10-15 (abs geomean 1.066/54) though nightlies are green from baseline absorption. No fixer; re-chase rechase-13565-assignee-p-067f 10-16 09:00Z
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

10-15 per-workload: conformance 1.092, implicit_conversion 1.093, overload_resolution 1.062,
sema_generics 1.016, mdl_dxr 1.042, minimal 1.089.

## Non-bisect dispatches (don't count them as a started bisect)

- Run 38708636360 (10-15 08:51Z, jvepsalainen-nv): `workflow_dispatch` on `test/benchview-upload`
  @`40d292c0e`, "Test BenchView upload with archived nightly results". This is tooling work.

## Timeline

- 10-10: filed; re-chase `rechase-13565-semcheck-p-4f67` (fired 10-13).
- 10-13: [Update] sent to the dashboard (owned, silent); re-chase `rechase-13565-assignee-p-067f`
  set for 10-16 09:00Z. If still silent, it asks the operator about (a) a persistence comment and/or
  (b) a bot bisect, which needs operator authorization for the shared perf runner.
- 10-15 11:40Z: re-measured (table above); task prompt updated with the method and the non-bisect run.
