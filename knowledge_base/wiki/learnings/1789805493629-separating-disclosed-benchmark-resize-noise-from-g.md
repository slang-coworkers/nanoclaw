---
title: "Separating disclosed benchmark-resize noise from genuine compiler perf regressions in Slang's Nightly MDL Perf Test"
type: learning
topic: slang-compiler
source: learnings/1789805493629-separating-disclosed-benchmark-resize-noise-from-g.md
---

# Separating disclosed benchmark-resize noise from genuine compiler perf regressions in Slang's Nightly MDL Perf Test

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-09-19T08:11:33.629Z
---

# Separating disclosed benchmark-resize noise from genuine compiler perf regressions in Slang's Nightly MDL Perf Test

When `trend.py`'s compile-perf gate flags a nightly MDL Perf Test failure with many workloads/metrics lit up at once, don't treat it as one blob — split it:

1. **Check for a disclosed benchmark-methodology change first.** Search recently-merged PRs touching `tools/compile-perf/lib/manifest.py` for `default_size`/`sweep_sizes` edits. If a human-reviewed PR changed a workload's `default_size`, its own PR body often *predicts* the expected before/after ratio (e.g. Slang PR #13035 explicitly said "one night of movement on those four [workloads] is expected"). Any flagged workload matching that predicted list + ratio is **not a regression** — it's the gate correctly detecting an intentional, disclosed change.

2. **What's left after removing resize-explained workloads is the real signal.** Look at which timer got flagged, not just which workload. A genuine localized pass regression shows up in a **sub-pass timer** (`specializeModule`, `simplifyIR`, `linkAndOptimizeIR`) while the workload's own `compileInner` (full wall-clock) stays clean — because the regression is a fraction of total time, not enough to trip the workload-level ratio threshold on its own. If `compileInner` *also* moves for every workload, suspect host/runner contention instead of a code regression.

3. **Narrow suspects to PRs touching `source/slang/core.meta.slang` / `hlsl.meta.slang`** (the shared core/HLSL prelude, checked+specialized on every single compile since `bench.py` spawns a fresh `slangc` process per sample — no cross-process module cache). Adding new generic functions/overloads there is a classic way to inflate `specializeModule`/`simplifyIR` cost broadly across unrelated workloads, and is easy to miss because the PR title ("Support generic builtin vector dot products") gives no hint it's a perf-sensitive change.

4. Cross-reference self-merge status (author == merged_by, no APPROVED review) on every candidate PR in the commit window — it's a fast triage signal for where review rigor was lowest, not proof of causation.

Full worked example (2026-09-19 scan): 4 workloads' 2.4–10x jumps → PR #13035 resize (not a regression); separate ~1.7-2.4x `specializeModule`/`simplifyIR` jump on other workloads → traced to self-merged PRs #13138/#13135 adding new generics to the core/HLSL prelude. See `/workspace/agent/tasks/tot-regression-scan-fd83.md` (2026-09-19 08:1x entry) for full detail.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789805493629-separating-disclosed-benchmark-resize-noise-from-g.md`_
