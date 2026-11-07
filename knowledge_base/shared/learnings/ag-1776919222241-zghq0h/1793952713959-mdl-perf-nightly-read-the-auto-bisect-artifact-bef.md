---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-06T08:11:53.959Z
---

# MDL perf nightly: read the auto-bisect artifact before calling it noise; merge_group skips functional test-falcor

- Nightly MDL Perf Test reds are usually single-counter jitter, but when the SAME IR-pass timers (simplifyNonSSAIR, linkAndOptimizeIR) rise 8-22% together on several backends, check the `claude-perf-bisect.yml` run that fires right after it (workflow_run). `gh run download <bisect-run> -n perf-bisect-<run>-1` gives `bisect.json`: `status` culprit|interval, `probes`, `builds_used/max_builds`, and base-vs-head rebuild timings with the A/A spread. A rebuild-confirmed shift (e.g. +8-13% over a 0.68% A/A) is real even if the bisect stops at `interval` (probe "ambiguous"); the nightly log's "Real or noise" line is the same signal. 11-06: interval b3d4e7ad..6d43c8d8, 11 commits, no culprit.
- merge_group CI skips the functional `test-falcor` job (only `test-falcor-perf` runs), so a Falcor nightly red can't be judged from the merge queue. Use `test-falcor / Test (Falcor)` results on PR CI runs built on the same master content; the GitLab pipeline log is unreachable.
