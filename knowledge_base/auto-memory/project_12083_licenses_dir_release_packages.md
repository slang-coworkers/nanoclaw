---
name: project_12083_licenses_dir_release_packages
description: "slang#12083 ship LICENSES/ dir in release pkgs — MERGED (PR #12085 squash c744924); approver ABSTAIN_POLICY→human APPROVED; TERMINAL"
metadata: 
  node_type: memory
  type: project
  originSessionId: 232d151e-14b5-40a6-a7c9-1085b7c13c00
---

**slang#12083** — "Include LICENSES directory in release packages" (jkwak-work, maintainer, self-filed).

Release archives ship top-level `LICENSE` but omit the repo's `LICENSES/` dir (7 SPDX texts: Apache-2.0, BSL-1.0, CC-BY-4.0, LicenseRef-UOI-NCSA, LLVM-exception, MIT, Unlicense). Binary consumers can't get bundled texts without a source checkout. Distinct from #4117 (which fixed missing top-level LICENSE/README.md). Confirmed on ToT (340a191c5) by source inspection.

**Classification:** enhancement/packaging-completeness · medium · CI/build-packaging (CMake+release workflow) · P2.

**Recommended fix (A = Preferred solution):** `install(DIRECTORY LICENSES/)` mirroring #4117 + cover WASM in-workflow + net-new packaging check.
- `CMakeLists.txt:621-626` (Site 1, CPack)
- `.github/workflows/release.yml:283-311` (Site 2, WASM bypasses CPack via `exit 0` → needs own `cp`)
- `release.yml:~350` existing "File check" is only a MIME print, not a gate.

**State (2026-07-13):** jkwak-work opened **PR #12085** "Include license texts in release packages" (his own follow-through; predicted sites confirmed — `.github/workflows/release.yml` +2, `CMakeLists.txt` +7, +9/-0). `pr_ready_for_review` webhook → routed to slang-pr-approver. Approver verdict = **ABSTAIN_POLICY** (`CLAUSE_FAIL:no_protected_paths` — touches `.github/**`, matches `v0-shadow-relaxed` protected-path gate); recorded to ledger @ head `d66073756123`. By design → routes to human maintainer (= jkwak, the author). Not BLOCK (no 🔴), not ABSTAIN_INFRA (review harvested; CodeRabbit only, Devin timed out). Advisory flagged for maintainer: CMake `install(DIRECTORY LICENSES … PATTERN ".*" EXCLUDE)` + WASM `cp -R` neither validates expected license files present → risk of partial `LICENSES/`. Matches `.github/**` abstain calibration in [[project_12074_compileperf_nightly_abstain_policy]], [[project_12023_compileperf_sweep_abstain_policy]].

**TERMINAL (2026-07-13 17:43 UTC):** jkwak-work MERGED PR #12085 (squash `c744924`), merged content == approver decision commit `d66073756123` — **unchanged**. `record_human_verdict` → APPROVED stamped onto the ABSTAIN_POLICY row (excluded from agreement scoring; no false-safe risk — approver never approved). CodeRabbit's 🟡 packaging-robustness nit merged as-is, confirming non-blocking gap classification was correct. Chain closed; reopen only on a fresh substantive human comment.

Original triage: jkwak-work self-filed AND self-assigned (COLLABORATOR) → per no-autofixer-on-maintainer-self-owned policy, NO slang-fixer dispatch. Verdict 5-bullet posted (issuecomment-4959852939), Issue Type=Feature. See [[feedback_no_double_dispatch_peer_wired]], [[project_11806_cmake_options_maintainer_selffix]].
