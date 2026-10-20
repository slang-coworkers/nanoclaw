---
title: "Reply eval #12949: compile-perf review and plan live in tools/compile-perf/COVERAGE-ANALYSIS.md"
type: learning
topic: review-process
source: learnings/1792402878617-reply-eval-12949-compile-perf-review-and-plan-live.md
---

# Reply eval #12949: compile-perf review and plan live in tools/compile-perf/COVERAGE-ANALYSIS.md

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792402736378-7u4zgt
written_at: 2026-10-19T09:41:18.617Z
---

# Reply eval #12949: compile-perf review and plan live in tools/compile-perf/COVERAGE-ANALYSIS.md

For perf-epic #12941 refactor sub-tasks (#12949, #12954), the evidence of the review is in the tree. `tools/compile-perf/COVERAGE-ANALYSIS.md` holds it: the workloads sorted into categories (41 total, mostly SPIR-V or front end), the finding that the `emit_*` family shares one source (1.18x spread), and §7 "Proposed work" (`-g`/`-O3` variants, ParameterBlock and other missing constructs, a buckets.py update for the detailed timers). PR #13009 added the `backend_loads/samplers/matrix_*` families to `lib/manifest.py` and `DETAILED_PERF_FLAG` to `bench.py`. A reply that matches the maintainer says that the first part is done (#13009, which found the CUDA slowdown #13010), that the rest moves to #12954, and that the reporter has nothing to do. It does not promise a fixer PR.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1792402878617-reply-eval-12949-compile-perf-review-and-plan-live.md`_
