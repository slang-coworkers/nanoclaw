---
title: "[approver/human-agreement] slang-rhi real-hardware CI substitutes for a timed-out Devin on backend-logic PRs"
type: learning
topic: review-approval
source: learnings/1784271405834-approver-human-agreement-slang-rhi-real-hardware-c.md
---

# [approver/human-agreement] slang-rhi real-hardware CI substitutes for a timed-out Devin on backend-logic PRs

**Symptom:** A slang-rhi backend *logic* change (D3D12 timestamp query resolve refactor, #797 @ b34042ac) landed on the fallback tier with Devin timed out (devin-fetch.sh exit 143, no flags) and only a CodeRabbit review whose two findings were test-only nits. Fallback-tier verdict mapping is fuzzy, and a timed-out Devin on behavior-changing code would normally push toward ABSTAIN.

**Root cause / why it resolved to WOULD_APPROVE anyway:** slang-rhi runs the full test suite *inline in the build matrix jobs on real GPU adapters* (see prior learning: slang-rhi runs full CI matrix incl. tests on draft). So the missing Devin signal is not the only runtime signal — CI is. For #797, the CI logs (job on `build (windows, x86_64, msvc, Release)`) showed the PR's OWN new test `cmd-query-d3d12-non-blocking-result-readiness.d3d12 PASSED` on a real D3D12 device, plus all pre-existing `cmd-query-*.d3d12` regression tests PASSED (including `range-across-command-buffers.d3d12`, which is exactly the merge-path coverage CodeRabbit's nit asked for). That is *stronger* corroboration than a static Devin "0 bugs" pass, which never runs tests.

**How to catch it / the transferable rule:** On the slang-rhi fallback tier, when Devin fails/times out, don't default to ABSTAIN on a behavior change — first pull the CI *job logs* (not just the combined status) and grep for the PR's new/related test names. If the exact behavior-changing test executed on a real adapter and PASSED (confirm a `hardware-device ... timestamp-query` line, not `software-device`/`SKIPPED`), real-hardware CI is a valid substitute for the missing Devin run, and the challenger's own source inspection closes the coverage gap. The decisive check is `gh run view --job <id> --log | grep <test-name>` → `PASSED` on `.d3d12`.

**Fix:** Treat real-hardware green CI (job-log-verified for the specific new test) as first-class runtime evidence on the Devin-only/fallback tier for slang-rhi; reserve ABSTAIN for cases where the test is SKIPPED (no adapter), the new behavior isn't exercised by any test, or CI is not green. Awaiting human join (merge/close/review by ccummingsNV) to score.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784271405834-approver-human-agreement-slang-rhi-real-hardware-c.md`_
