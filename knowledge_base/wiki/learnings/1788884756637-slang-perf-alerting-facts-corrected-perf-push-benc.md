---
title: "Slang perf-alerting facts corrected: perf-push-benchmark-results.yml is COMPILE-TIME MDL, not runtime; benchview IS in-repo (bench.py comments only)"
type: learning
topic: slang-compiler
source: learnings/1788884756637-slang-perf-alerting-facts-corrected-perf-push-benc.md
---

# Slang perf-alerting facts corrected: perf-push-benchmark-results.yml is COMPILE-TIME MDL, not runtime; benchview IS in-repo (bench.py comments only)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788881757170-vg81k6
written_at: 2026-09-08T16:25:56.637Z
---

# Slang perf-alerting facts corrected: perf-push-benchmark-results.yml is COMPILE-TIME MDL, not runtime; benchview IS in-repo (bench.py comments only)

While triaging/planning shader-slang/slang#12952 (Slack webhook for RUNTIME perf-regression alerts), codex source-review corrected two claims that circulate in prior learnings/triage and are easy to repeat wrongly. Verified against live `master` 2026-09-08:

1. **`.github/workflows/perf-push-benchmark-results.yml` is a COMPILE-TIME benchmark, not runtime.** It runs `tools/benchmark/compile.py --samples 16 --target dxil` (line 43) — the MDL slangified-shader compile-time sweep — and pushes `benchmarks.json` to `shader-slang/slang-material-modules-benchmark`. A prior shared learning mislabeled it "runtime benchmark pipeline / private runtime store." It is neither runtime nor (necessarily) the runtime data source #12952 needs. Don't cite it as a runtime results store.

2. **"benchview appears nowhere in the repo" is FALSE.** `benchview` appears in `tools/compile-perf/bench.py` documentation/comments at lines 113, 133, 926 — describing that the compile-perf raw-sample archive is designed to be compatible with a BenchView submission format (BenchView recomputes its own summary from samples within 1e-9). There is NO BenchView integration/ingestion code and nothing runtime. Accurate claim: "no public-repo Falcor runtime→BenchView publishing integration exists," not "benchview is absent."

3. **A straight fork of the compile-perf Slack template does NOT satisfy a rich-alert spec.** `tools/compile-perf/slack_status.py` emits only a generic sentence (e.g. "Regression detected (>=10% over trailing median)"); the Slack payload (`nightly-mdl-perf-test.yml:517-525`) carries a CI-run link + the *compile-perf* dashboard link but no benchmark-specific magnitude or commit/PR link. `trend.py` computes per-benchmark deltas (annotations ~:328-348) and surfaces a short commit SHA only in its daily label — no PR/commit LINK. And `trend.py`'s trailing-median (`--window 7`) is adaptive, so it does NOT detect gradual "death-by-a-thousand-cuts" drift — that needs a distinct stable historical baseline.

Meta-lesson: source-verify inherited learnings before repeating them in a report; recall hits can carry mislabels. A critique-gate (codex PLAN/CODE/OUTPUT review) caught all three before delivery.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788884756637-slang-perf-alerting-facts-corrected-perf-push-benc.md`_
