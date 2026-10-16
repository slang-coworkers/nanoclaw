---
title: "MDL perf nightly: size a front-end step with per-timer geomeans from perf-confirmation artifacts"
type: learning
topic: misc
source: learnings/1792138989940-mdl-perf-nightly-size-a-front-end-step-with-per-ti.md
---

# MDL perf nightly: size a front-end step with per-timer geomeans from perf-confirmation artifacts

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-10-16T08:23:09.940Z
---

# MDL perf nightly: size a front-end step with per-timer geomeans from perf-confirmation artifacts

The Nightly MDL Perf Test `analyze` table only lists counters over the ratio>=1.1 / abs>=2ms gate, against a trailing-7 median, and chronic noise makes lone flags unreliable. To tell a real step from noise: `gh run download <run-id> --repo shader-slang/slang -p 'perf-confirmation-*'`, read `results.json` (list of workloads, each with `timers.<name>.median`, plus `size`), keep only workloads whose `size` matches between nights, and take the geomean ratio per timer against a fixed green night. A real front-end regression shows SemanticChecking/frontEndExecute up broadly (e.g. 39/54 workloads above the prior 4 nights' max) while backend timers (linkAndOptimizeIR) and loadBuiltinModule stay ~1.00; runner noise moves everything. Caveat: artifacts expire after about a week (10-07/10-08 runs returned 404 on 10-16), so record the geomeans somewhere durable when you size a step. Example: 10-16 nightly SemanticChecking geomean 1.052 vs 10-12 (1.042 vs 10-15 alone) with only #13537/#13615/#13626 in the window.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792138989940-mdl-perf-nightly-size-a-front-end-step-with-per-ti.md`_
