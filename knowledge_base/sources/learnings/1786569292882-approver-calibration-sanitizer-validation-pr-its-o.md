---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786567542253-5f47jj
written_at: 2026-08-12T21:14:52.882Z
---

# [approver/calibration] sanitizer-validation PR — its own control red + author-declared WIP = ABSTAIN, not BLOCK (verified UB in pre-existing code is not a change-defect)

## Context
slang-rhi#711 "Add ASAN support for clang" (skallweitNV, MEMBER). A build-flag PR that adds a NEW `sanitizers.yml` CI workflow — i.e. the PR ships its OWN positive control. Fallback/Devin-only tier (no production `github-actions[bot]` review — dev-branch class skip; CodeRabbit stale). Two `synchronize` in one session. Decided ABSTAIN_POLICY:CHALLENGER_CONCERN.

## Symptom / trap
Devin flagged 2 🔴 and the PR's own sanitizer control was RED 3/3 at the head, with a real UBSan finding (`member call on null pointer of type 'slang::TypeReflection'`, `src/device.cpp:37:44`). Naive read → BLOCK. Both are wrong reasons to BLOCK.

## Root cause / correct calibration
1. **Verified UB in a stack trace is only a BLOCK if it is a defect IN THE CHANGE.** The faulting file `src/device.cpp` was NOT in the PR diff — pre-existing shipping code the new sanitizer merely EXPOSES. BLOCK asserts a bug in the change; this isn't one. → check `gh pr diff --name-only` for the faulting file before calling any sanitizer/CI failure a BLOCK.
2. **A previously-green leg going red can be red PROGRESS, not a regression.** The 2nd-revision "tweaks" commit added `abort_on_error=1` and made `filter-lsan-reports.py` SURFACE non-LSan reports (previously silently discarded) and return 1. That is why Linux — green at R1 — failed at R2: the sanitizer stopped silently passing. Making a sanitizer fail loudly is it working, not a defect the PR introduced. Also refuted Devin's 🔴 "memory errors silently turned into passing runs."
3. **Author-declared WIP scaffolding in the diff is a CI-INDEPENDENT abstain signal.** `.github/workflows/ci.yml` and `sanitizers.yml` carried explicit "Remove this … before merge" TEMPORARY guards disabling the regular pipeline for the branch. The author states in the diff that it isn't merge-ready → a human must look, whatever the CI color. Decisive on its own.
4. **#811 combined-status trap present:** `repos/…/commits/<sha>/status` = success (license/cla + CodeRabbit only), blind to the red Actions check-runs; `eval-clauses.py ci_green_on_sha` reads that endpoint (and the mounted wide policy sets `require_ci_green=false` anyway). Read `statusCheckRollup` / `actions/runs?head_sha=` / `check-runs` for the true CI state on any build/CI PR.

## How to catch it
On a PR that adds/edits its own sanitizer or CI workflow: (a) read that new control's per-leg check-runs at the pinned head; (b) for any red, trace to cause and ask "is the faulting file in the diff?" — pre-existing code exposed ≠ change-defect (ABSTAIN, not BLOCK); (c) grep the diff for TEMPORARY/"before merge"/branch-gated `if:` — author-declared WIP is a standalone ABSTAIN. Fallback tier + any uncertainty ⇒ ABSTAIN, never round up.
