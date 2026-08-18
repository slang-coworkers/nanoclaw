---
title: "Nightly MDL Perf Test = compile-time perf gate, not a GPU/corpus test"
type: learning
topic: agent-ops
source: learnings/1784184423207-nightly-mdl-perf-test-compile-time-perf-gate-not-a.md
---

# Nightly MDL Perf Test = compile-time perf gate, not a GPU/corpus test

The `Nightly MDL Perf Test` workflow (shader-slang/slang) is a **front-end compile-time perf gate**, not a GPU/correctness or MDL-corpus runtime test. Build + MDL sweep + publish all pass; the ONLY failing step is `Check trend (fail on regression)`, which runs `tools/compile-perf/trend.py` and exits 1 when any workload's compile timer regresses vs a trailing-window median (gate: ratio ≥ 1.25 AND Δ ≥ 2.0 ms).

Triage implications:
- A red here is a **perf-threshold trip**, distinct from "test crashed/failed." Classify by reading the trend step, NOT the whole run as red. `mdl_dxr` corpus compileInner can be stable while micro-benchmarks (interface_depth, implicit_conversion, serialize — SemanticChecking/frontEndExecute) flag.
- Do NOT auto-rerun as infra flake. It's a real code-attributable signal — bisect the SHA streak (last-green → first-red) and name the culprit PR for a human owner.
- **Gate is sensitive/near-threshold noisy:** small regressions (1.26–1.30x, +3–16ms) can go green AND red on the SAME SHA across dispatches — run-to-run variance straddles 1.25. A multi-day streak across distinct SHAs is the real signal; a single same-SHA red is not.
- **Baseline-window confounds:** `tools/compile-perf` changes (e.g. #12086 reporting redesign, 07-15) can shrink the trailing baseline (7-pt→3-pt) and add NEW workloads (interface_depth). New-workload flags measured against a thin baseline overstate magnitude — read them with caution, prefer stable pre-existing workloads for attribution.
- Historical trap: the first reds (07-12/07-13) crashed on a `UnicodeEncodeError` (`Δ` char, cp1252 on the Windows runner) — but in trend.py that print is AFTER `if not regressions: return`, so the crash still means a regression was flagged; it's downstream of detection, not instead of it. Fixed by 07-14.

Case: 5-day streak 07-12..07-16, bisect window was a single commit `8f0c3515` = PR #11615 "Fix generic interface witness lowering" (large semantic-checker rework) → real front-end regression on interface/conversion workloads.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784184423207-nightly-mdl-perf-test-compile-time-perf-gate-not-a.md`_
