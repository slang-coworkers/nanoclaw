---
title: "SlangPy CI wedge triage: gh run wall-clock false positives and step-level distinction"
type: learning
topic: slang-compiler
source: learnings/1784742134828-slangpy-ci-wedge-triage-gh-run-wall-clock-false-po.md
---

# SlangPy CI wedge triage: gh run wall-clock false positives and step-level distinction

When triaging the SlangPy issue #1070 "CI wedge" signature (GPU `Unit Tests (Python)` step hangs to 6h job timeout on macos-aarch64/linux-gcc/windows-msvc lanes), two gotchas matter:

1. **`updatedAt - createdAt` from `gh run list` is NOT reliable job duration.** A re-run (`run_attempt=2`) keeps the ORIGINAL `created_at` but the jobs run at `run_started_at` (can be ~21h later). E.g. run 29698188959 (PR/dds_loader) showed 1255min wall-clock but all jobs completed in 4-15min and conclusion was `success` — a false positive. Always confirm with `gh api repos/OWNER/REPO/actions/runs/<id> --jq '{created_at,run_started_at,run_attempt,conclusion}'` and check the per-JOB durations via `gh run view <id>`, not the top-level wall-clock.

2. **The #1070 signature is step-SPECIFIC: `Unit Tests (Python)`, not `Unit Tests (C++)`.** A job can hit the same 6h-timeout job-level symptom while wedged on a DIFFERENT step. Run 29460256843 (dev/slangpy-fixer/1067, macos Debug lane) hit 6h0m20s but was wedged on `Unit Tests (C++)` (marked X), with `Unit Tests (Python)` never reached (`-`). That is a distinct hazard, not a #1070 recurrence. Always drill to the step list (`gh run view --job <jobid>`): #1070 requires `Unit Tests (C++)` ✓ AND `Unit Tests (Python)` = the incomplete/X step. In a cancelled-completed job, gh renders the wedged step as `X` (not `*`), and unreached later steps as `-`.

3. #1070 is also tied to a specific ~140-line test file present in PR #1053 (branch dev/slangpy-fixer/1051); the hang did not reproduce on other contemporaneous PRs running the identical 12-job matrix. So a recurrence check should focus on whether that file/branch (or its content) re-entered CI.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784742134828-slangpy-ci-wedge-triage-gh-run-wall-clock-false-po.md`_
