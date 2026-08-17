---
title: "Discriminate a per-job timeout-minutes cancel: PR-specific cost regression vs systemic capacity ceiling"
type: learning
topic: ci-tooling
source: learnings/1786198665211-discriminate-a-per-job-timeout-minutes-cancel-pr-s.md
---

# Discriminate a per-job timeout-minutes cancel: PR-specific cost regression vs systemic capacity ceiling

A `cancelled` CI job is three different things (supersede / infra / per-job `timeout-minutes` expiry) and the same `##[error]The operation was canceled.` text covers all three. Two cheap arithmetic controls separate them, and a third separates blame:

1. **Count DISTINCT cancel `completed_at` stamps in the run.** A supersede cancels everything at once → **ONE** stamp. Independent per-job timeouts → **N distinct** stamps, often spread over hours. (Observed 2026-08-08, shader-slang/slang run 31215412287: 6 distinct stamps spanning 21:41Z→01:40Z — definitively not a supersede.)

2. **Compare each cancelled job's elapsed against the ceiling configured in its REUSABLE workflow file**, not the caller. Matches within ~1 min ⇒ the timeout fired. Same run: linux-debug-rhi 30.1min vs `ci-rhi-test-container.yml:20` = 30; win-debug-gpu-rhi 50.3 vs `ci-rhi-test.yml:30` = 50; macos-debug-aarch64 80.3 vs `ci-slang-test.yml:57` = 80; materialx 15.3 vs `ci-materialx-regression-test.yml:25` = 15. The round numbers are the tell.

3. **THE ATTRIBUTION STEP most likely to be skipped — cross-section the timeout class by BRANCH over recent runs of the same workflow.** A timeout expiry is *not* self-evidently the PR's fault. Sample ~60 recent completed runs of the workflow, keep jobs cancelled within 2 min of their ceiling, and group by `head_branch`:
   - fires **only on this PR's branch** ⇒ the PR's own cost regression, author-owned, **rerun cannot succeed** (#12354: all 4 timeout classes fired only on `security-fossil-format-relative`, consistent with the fossil-validation graph walk the PR itself documents at ~2s/process).
   - fires on **unrelated branches too** ⇒ systemic capacity ceiling, not this PR (`test-materialx-windows-release` hit its 15-min ceiling on 2 unrelated branches in the same window).

**Why it matters:** bucketing on `conclusion` alone files these as "flake" and triggers a futile rerun; bucketing them as "benign cancel" hides a real cost regression. Both errors are silent. Also note the run-level `conclusion=cancelled` **masks job-level failures** — inspect jobs, and remember `check-ci` is an aggregator that is red only because siblings are, so it is never its own bucket.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786198665211-discriminate-a-per-job-timeout-minutes-cancel-pr-s.md`_
