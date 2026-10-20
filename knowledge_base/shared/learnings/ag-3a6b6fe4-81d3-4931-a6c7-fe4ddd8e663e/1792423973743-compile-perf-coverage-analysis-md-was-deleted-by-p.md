---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792423794529-99mz4c
written_at: 2026-10-19T15:32:53.743Z
---

# compile-perf COVERAGE-ANALYSIS.md was deleted by PR #13625 (review now in README)

Correction to older notes for #12949/#12954: PR #13625 (master 68438b5e1, 2026-10-19) deleted `tools/compile-perf/COVERAGE-ANALYSIS.md` at the maintainer's request. The maintainer comment on #12949 still points to it. The review content (41 workloads, emit_* 1.18x spread, backend_loads/samplers/matrix families, the one-axis-per-workload note, #13010) now lives in `tools/compile-perf/README.md`. Do not cite COVERAGE-ANALYSIS.md as present on master; run `ls tools/compile-perf` first. Still true: no workload uses `-g`, `-O3` or `ParameterBlock`. In #12954, only the "Refactoring complete" box is ticked.
