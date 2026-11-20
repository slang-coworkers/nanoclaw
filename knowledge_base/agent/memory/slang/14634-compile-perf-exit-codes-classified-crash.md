---
type: chain
title: "slang#14634 — compile-perf bench.py misclassifies #14573's positive exit codes as crashes (TOT-scan find, filed-only)"
description: Found by the 11-19 12:00Z TOT regression scan; verified live by Main before filing; filed 11-19 ~12:2xZ as #14634 (reproduced + Type Bug). Nightly MDL Perf Test red since Nov 19 (run 44463513377) — PR #14573 (merged 11-18, 8df5bc21) changed slangc's intentional compile-error exit from -1/255 to positive 2/3/4/5 and updated 344 files but touched 0 under tools/compile-perf; bench.py classify_sample flags rc>1 as crash. Filed-only per policy; fixer GO held for the operator.
tags: [slang, compile-perf, exit-codes, ci-harness, tot-scan, filed-only]
---

# slang#14634 — compile-perf nightly: bench.py expects old exit(-1)

- **What:** Nightly MDL Perf Test red since Nov 19 05:12Z (run 44463513377, head a22c1420) after 4 green
  nights. The `diagnostics` workload (n=9600 intentional `E30019`s) now FAILs: after PR **#14573**
  ("Return positive exit codes from slangc", merged 11-18 05:33Z, `8df5bc21`) slangc exits **2** on
  intentional errors, and `tools/compile-perf/bench.py` `classify_sample` flags `rc > 1` as crash
  (`_EXIT_NEGATIVE_ONE = (255, 0xFFFFFFFF)` :694; `is_crash = (rc > 1 or rc < 0) and not expected_failure`
  :728). #14573 changed 344 files, 0 under `tools/compile-perf/`.
- **Verified by Main before filing:** run conclusion=failure at a22c1420; bench.py lines 694/728 match;
  gh search found no existing tracker; #14573 file-list 100 files / 0 compile-perf.
- **Filed:** 2026-11-19 ~12:2xZ, #14634, labels `reproduced` + Issue Type Bug. Distinct from #14338/#14442
  (docs/generated fixtures).
- **Suggested fix (in the issue body):** extend `_EXIT_NEGATIVE_ONE` with 2 (and likely 3), update self-check
  asserts, check `sweep.py`/`trend.py`/`manifest.py` consumers. The nightly stays red until it lands.
- **Disposition:** FILED-ONLY per the filing policy (low-severity CI-harness bug, shepherds loaded); fixer GO
  offered to the operator 11-19. Scan task told the tracker exists (prevents re-flagging as untracked).
- **Source:** the 12:00Z TOT scan's report (slang-release-regression-check), which located the mechanism.

# Citations
- https://github.com/shader-slang/slang/issues/14634
- https://github.com/shader-slang/slang/actions/runs/44463513377
- https://github.com/shader-slang/slang/pull/14573
