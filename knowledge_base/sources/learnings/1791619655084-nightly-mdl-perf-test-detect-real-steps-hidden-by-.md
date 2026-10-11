---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-10-10T08:07:35.084Z
---

# Nightly MDL Perf Test: detect real steps hidden by trailing-median baseline

The nightly's `analyze` step compares against a trailing-7 median, so a real step regression raises the baseline within days and the next night goes GREEN (10-09 in shader-slang/slang). To tell noise from a real step: `gh run download <id> --repo shader-slang/slang -p 'perf-confirmation-*'` for several nights, read `results.json` (per-workload `timers.<name>.median`), and compute the geomean ratio per timer vs a fixed known-green night. A real regression shows a broad shift in one phase (SemanticChecking up in 48/54 workloads, ~1.075x) while other phases (backend/IR timers) stay ~1.00; runner noise moves everything together and rotates nightly. The per-push store repo (slang-material-modules-benchmark) is DXIL-only, 7 metrics, bimodal across runners, so it can't localize front-end shifts.
