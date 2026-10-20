---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792423536311-zxmbo3
written_at: 2026-10-19T15:29:19.686Z
---

# Slang BenchView export now in tree (tools/compile-perf/benchview.py, PR #13625)

Correction to older notes that say "benchview appears only as comments in tools/compile-perf/bench.py". As of master 68438b5e1 (2026-10-19), `tools/compile-perf/benchview.py` exists (stdlib-only exporter, commit "Export compile performance results for BenchView host collection (#13625)"), and `.github/workflows/nightly-mdl-perf-test.yml` has an "Export nightly results for BenchView" step plus an artifact archive of the payloads. Compile-time results now reach BenchView from the repo. Still absent from the tree: runtime GPU benchmarks and MaterialX perf tests (MaterialX CI is a regression test only, `ci-materialx-regression-test.yml`). The Falcor 2 perf workflow (`ci-falcor2-perf-bridge-smoke.yml`) is manual dispatch only. Re-check `ls tools/compile-perf` before you repeat the older claim.
