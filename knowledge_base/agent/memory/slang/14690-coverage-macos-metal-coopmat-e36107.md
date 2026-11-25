---
type: chain
title: "slang#14690 — coverage-macos: 8 metal coopmat tests fail cpu/llvm legs (#14662 targets=all × #14540 require-enforcement) — TOT-scan find, filed-only"
description: RESOLVED 2026-11-23 (found resolved, no fixer needed): coverage-macos metal-coopmat red was fixed by #14674 (CI test-tiering, 411af9b9, 11-21 13:26Z — 5h after the filing) rewriting the 8 files to targets=all-cpu-llvm, excluding the failing cpu/llvm legs. Resolution comment posted 11-23 (id 7100454117); GO offered 11-21 withdrawn; issue left for maintainer close. Coverage-macos green on 11-23 nightly.
tags: [slang, coverage-macos, cooperative-matrix, targets-all, require-enforcement, tot-scan, filed-only]
---

# slang#14690 — coverage-macos metal-coopmat E36107 break

- **What:** Nightly Slang Coverage Test `coverage-macos` job red since 11-21 02:39Z (run 44853626851,
  head 0a87e896; last green 44657932517 11-20 02:02Z @ d6bbb48a). 8 metal cooperative-matrix tests fail
  their (cpu)/(llvm) legs (16 legs) with deterministic `error[E36107]: unavailable features in entry point`.
- **Cause (verified by Main before filing):** E36107 confirmed in the job log; `targets=all` confirmed live
  on metal-coverage.slang at master; `[require(cooperative_matrix)]` sites confirmed in hlsl.meta.slang
  (~:30310/:30327/:30335 locally); no existing tracker (searched). Two merged-11-20 changes interact:
  **#14662** (jkwak-work, targets=metal→targets=all rewrite, 17:51Z) + **#14540** (nv-slang-bot — OUR
  #14430 chain fix, [require] enforcement on static members through generic types, 09:06Z). Enforcement
  intentional; the cpu/llvm legs can't satisfy it. coverage-macos is the only tier running `-api -mtl`
  (executes //TEST(metal) lines' non-metal legs) — required CI and coverage-linux/windows green on same head.
- **Filed:** 2026-11-21 ~08:2xZ, #14690 (reproduced + Type Bug). Fix direction in the issue: restore
  `targets=metal` (per #14561) or capability-gate.
- **Disposition:** FILED-ONLY per filing policy; fixer GO offered to the operator (test-only 8-file change,
  keeps coverage-macos red until landed). Because the interacting enforcement is OUR merged PR, this is
  natural follow-up cleanup for the #14430 chain — flagged in its record too.
- **Source:** 11-21 08:0xZ TOT scan report (high-confidence forensics: window d6bbb48a→0a87e896, test-line
  history verified at each ref).

# Citations
- https://github.com/shader-slang/slang/issues/14690
- https://github.com/shader-slang/slang/actions/runs/44853626851
- https://github.com/shader-slang/slang/pull/14662
- https://github.com/shader-slang/slang/pull/14540
