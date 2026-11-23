---
type: chain
title: "slang#14693 — MDL perf: apiLoadModule 1.10-1.19x regression since 11-21 (suspect #14509) — TOT-scan find, filed-only"
description: Found by the 11-22 08:00Z TOT scan; verified live by Main (both run conclusions + analyze-step confirmation text + dedupe incl. closed #12406 history); filed 11-22 ~08:2xZ as #14693 (reproduced + Type Bug). Two-night + rerun minima-lift evidence (min 93.0 vs 84.8 baseline); suspect window ef93f4b7d→0a87e896 with #14509 primary, #14630 secondary. Perf regression, not correctness. Filed-only; bisect/fix is maintainer or GO'd chain work.
tags: [slang, mdl-perf, apiLoadModule, perf-regression, tot-scan, filed-only]
---

# slang#14693 — MDL perf apiLoadModule regression (11-21/22)

- **What:** Nightly MDL Perf Test `api_module_graph_bin/apiLoadModule` flagged two consecutive nights:
  11-21 run 44869688840 (head 0a87e896) 1.10x 84.8→93.7ms; 11-22 run 44988301006 (head 411af9b9) 1.19x
  84.8→101.1ms — analyze step "1 confirmed regression(s)", artifacts perf-confirmation-44988301006-1.
  apiTotal warns 1.10–1.14x both nights. Real-shift evidence: rerun samples [103.0, 95.8, 93.0, 101.1,
  103.3] — minimum ~10% above baseline median (noise-floor cases have minima AT baseline).
- **Suspects (window ef93f4b7d 11-20 → 0a87e896 11-21):** #14509 integer constant-folding overhaul
  (skiminki-nv, primary — front-end on the module-load path); #14630 sized/unsized buffer types
  (secondary); #14452/#14636 low. 11-22 adds only #14674 (CI tiering, perf-neutral) — persisted.
  Attribution = window reasoning; 4-commit window is bisectable.
- **Dedupe:** #12406 (old ~5× API-path regression, apiLoadModule never recovered) CLOSED 09-14 —
  referenced in the issue for history, not a duplicate.
- **Filed:** 11-22 ~08:2xZ, #14693 (reproduced + Type Bug). Fix = bisect + the owning PR's author;
  no fixer chain started (perf bisect is maintainer terrain or operator-GO'd work — held).
- **Also from the same scan (NOT filed):** CMake Options weekly red — deterministic C1001 at
  slang-emit-hlsl-prelude.cpp(468) on all 33 windows-aarch64 legs (MSVC 14.52 image 20261116.315.1);
  same toolchain family as the 11-20 Release ICE. #14642 moved release.yml to a native-ARM64 runner
  (green) but cmake-options.yml didn't get the change → red every Saturday until it does. Routed to the
  operator as an extension of the #14471/#14499 toolchain-pin conversation, no new issue.

# Citations
- https://github.com/shader-slang/slang/issues/14693
- https://github.com/shader-slang/slang/actions/runs/44988301006
- https://github.com/shader-slang/slang/pull/14509
- https://github.com/shader-slang/slang/issues/12406
