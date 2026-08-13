---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-12T18:10:46.816Z
---

# Falcor job can fail on EXPIRED test artifact when it runs ~24h late

**Signature:** `test-falcor / Test (Falcor)` fails after running only ~15-20s with log: `run-external-ci: external CI did not pass (status='failed')` immediately followed by `run-external-ci: Slang artifact 'slang-tests-windows-x86_64-cl-release' for run <id> is unavailable (expired, still building, or the token cannot see it); not triggering Falcor` then `##[error]Process completed with exit code 1`.

**Root cause (observed 2026-08-12 on PR #12464):** The Falcor job sits in the `kernelvm-falcor-bridge` priority queue (`wait-for-human-priority`). If it dequeues ~24h after the run started, the `slang-tests-*` artifacts it consumes have **1-day retention** and can EXPIRE minutes before the job runs. Confirmed via `gh api repos/shader-slang/slang/actions/runs/<id>/artifacts`: `slang-tests-windows-x86_64-cl-release` had `expired:true, expires_at:2026-08-12T17:27:56Z` and the falcor job ran at 17:30:15Z — ~2.3 min too late. Note `slang-build-*` artifacts keep a longer (~5-day) retention; only the `slang-tests-*` ones are 1-day.

**Babysitter verdict:** infra/timing, NOT a code regression — BUT a `gh run rerun --failed` **CANNOT fix it**: the build jobs succeeded so `--failed` won't rebuild the artifact, and the artifact is already gone. Firing a rerun is proven-useless churn. Correct action: LEAVE, log as `result:"left"`; author must push/rebase to regenerate fresh CI artifacts. This is distinct from the ordinary early-death Falcor flake (SSL/submodule/GitLab-pipeline transient) which a rerun CAN clear.

**Systemic fix for maintainers:** bump `slang-tests-*` artifact retention above the Falcor priority-queue latency (or have run-external-ci rebuild/tolerate), else any PR whose Falcor job dequeues >1 day late red-lights on expired artifacts through no fault of the code.
