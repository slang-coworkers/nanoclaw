---
title: "compile-perf tracker already captures rss_kb but it's dead on the Windows perf runner and never surfaced"
type: learning
topic: ci-tooling
source: learnings/1784095582129-compile-perf-tracker-already-captures-rss-kb-but-i.md
---

# compile-perf tracker already captures rss_kb but it's dead on the Windows perf runner and never surfaced

When triaging shader-slang/slang#12112 (add memory metrics to the compile-perf tracker), the non-obvious finding was that **bullet 1 — "peak RSS per workload" — is not greenfield.**

`tools/compile-perf/bench.py` (verified @ c5d4d76e6) ALREADY:
- detects GNU `/usr/bin/time -v` (`_detect_gnu_time`, :218) and wraps every timed compile in it (`run_once`, :230-256),
- parses "Maximum resident set size" into `rss_kb` (:250-251),
- stores `"rss_kb": stats(rsses)` per workload in results.json (:363-364, :391).

But it's effectively dead where it matters:
1. **Portability gap:** capture only fires when GNU `/usr/bin/time` exists. BOTH perf CI workflows run on the **Windows** pool (`nightly-mdl-perf-test.yml`, `compile-perf-release-sweep.yml` → `labels: [Windows, X64, nvrgfx-perf-kernelvm-bridge]`), where `/usr/bin/time` is absent → `rss_kb` is silently `None` on the exact machine that feeds shader-slang.org/slang-compile-perf. macOS BSD `time` also lacks that parsed line. So it only ever populates on Linux dev hosts.
2. **Never surfaced:** even where captured, NOTHING downstream reads `rss_kb`. `track.py:_point_metrics` (:67-79) iterates only `r["timers"]`; `trend.py` judges only timers; `report.py`/`breakdown.py` chart only timers.

**Lesson for triage:** before classifying a "please add metric X" tooling request as new work, grep the tool for the metric field name (`grep -rn "rss\|getrusage\|resident"`). The scaffold may already exist and the real work is portability + downstream surfacing, not first-time capture — a very different briefing for the fixer. Also always check the CI runner OS (`grep runs-on/labels` in the workflow) against what the tool's capture path depends on; a Linux-only measurement path on a Windows-only runner is a silent no-op.

The api-path driver (`native/api-driver.cpp`), by contrast, has zero memory measurement — the "session-create memory delta" (#9817's metric) genuinely is new: add a getrusage/GetProcessMemoryInfo sample after `createGlobalSession` returns (:447) and emit it as a driver stat; note `bench.py:parse_timers` (:34) only accepts `…ms` tokens, so a non-ms metric needs a new emit/parse channel. Tracker is stdlib-only by invariant (bench.py:8), so the Windows RSS path must be `ctypes`, not `psutil`.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784095582129-compile-perf-tracker-already-captures-rss-kb-but-i.md`_
