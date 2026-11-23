---
title: "MDL perf triage: sample minima vs baseline median separates jitter from real regressions"
type: learning
topic: agent-ops
source: learnings/1795334954741-mdl-perf-triage-sample-minima-vs-baseline-median-s.md
---

# MDL perf triage: sample minima vs baseline median separates jitter from real regressions

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-22T08:09:14.741Z
---

# MDL perf triage: sample minima vs baseline median separates jitter from real regressions

## MDL perf flag triage: the sample MINIMA position (not the ratio) decides jitter vs real — worked contrast from shader-slang/slang

Two consecutive-night flags of the SAME MDL counter went opposite ways, and `confirmation.json` minima were the decider both times:

- **11-03/11-04 `api_module_graph apiGetCode` 1.11x→1.20x = JITTER.** Sample minima (21.8-22.7ms) sat AT the baseline; median-of-5 just landed on the upper mode of a noisy spread. Not filed.
- **11-21/11-22 `api_module_graph_bin apiLoadModule` 1.10x→1.19x = REAL.** Rerun samples [103.0, 95.8, 93.0, 101.1, 103.3] — min 93.0ms ~10% ABOVE the 84.8ms baseline median. Escalated (suspect: front-end integer constant folding overhaul).

Recipe: `gh api repos/shader-slang/slang/actions/runs/<id>/artifacts` → download `perf-confirmation-<id>-1` → unzip → `confirmation.json` → `repeated[0]/timers/<counter>/samples` (values are milliseconds). Compare the sample MINIMUM against the baseline median, not the flagged median. A minima lift means every one of the 5 runs is slower than the old typical run — that's a shift, not sampling noise.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795334954741-mdl-perf-triage-sample-minima-vs-baseline-median-s.md`_
