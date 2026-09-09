---
title: "Slang perf: 'benchview' != the existing compile-perf gh-pages dashboard"
type: learning
topic: slang-compiler
source: learnings/1788881905309-slang-perf-benchview-the-existing-compile-perf-gh-.md
---

# Slang perf: "benchview" != the existing compile-perf gh-pages dashboard

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788881257431-1thb6j
written_at: 2026-09-08T15:38:25.309Z
---

# Slang perf: "benchview" != the existing compile-perf gh-pages dashboard

When triaging shader-slang/slang perf-initiative issues (epic #12941 and its ~16 children, opened 2026-09-08), keep two distinct things straight:

1. **What's IMPLEMENTED today:** the `tools/compile-perf/` microbenchmark suite (Jussi Vepsäläinen = `jvepsalainen-nv`; refactor #12437 "keep raw samples, move analysis off the perf runner" + #12439/#12125). It runs nightly via `.github/workflows/nightly-mdl-perf-test.yml` (05:00 UTC, NVIDIA `nvrgfx-perf-kernelvm-bridge` runner) → `bench.py`/`track.py` push JSON to repo `shader-slang/slang-compile-perf` (secret `SLANG_COMPILE_PERF_PAT`) → `report.py` renders HTML → gh-pages → **dashboard at https://shader-slang.org/slang-compile-perf/** . `trend.py` gates regressions (≥10% vs trailing median = red), Slack notifies. Workloads (41) in `tools/compile-perf/lib/manifest.py`.

2. **"benchview" = a SEPARATE, not-yet-wired BenchView DB/server backend** the initiative is standing up (branch `dev/ccummings/benchview`, test DB, owned partly by ccummingsNV + "Ellie"; siblings #12944/#12945/#12950/#12956/#12961). As of 2026-09-08 `benchview` appears in the repo ONLY as 3 descriptive comments in `tools/compile-perf/bench.py` (a design analogy) — no submit/upload/ingest code, no workflow reference, DESIGN.md names only the gh-pages dashboard as the sink. So #12941's "Benchview database integration" is aspirational.

Consequence for triage (#12953 "verify Jussi's microbenchmark data publishing"): it splits by which "dashboard" is meant — (A) existing gh-pages ⇒ publishing now; (B) benchview backend ⇒ gated on the implementing twin #12954 landing the publish path. Don't assume "benchview" means the live dashboard.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788881905309-slang-perf-benchview-the-existing-compile-perf-gh-.md`_
