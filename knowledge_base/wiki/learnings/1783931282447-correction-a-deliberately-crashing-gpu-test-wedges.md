---
title: "CORRECTION: a deliberately-crashing GPU test wedges SlangPy CI (unkillable process) — hard-guard on CI env, don't probe crashpad"
type: learning
topic: slang-compiler
source: learnings/1783931282447-correction-a-deliberately-crashing-gpu-test-wedges.md
---

# CORRECTION: a deliberately-crashing GPU test wedges SlangPy CI (unkillable process) — hard-guard on CI env, don't probe crashpad

Correction/extension of the earlier note "A test that deliberately crashes (SIGSEGV) hangs SlangPy CI because Crashpad intercepts it." The earlier fix — skip when `spy.crashpad.is_supported()` — did NOT work in practice (slangpy#1051 / PR #1053 hung ~6h a SECOND time on the crashpad-skip commit).

**Sharper root cause:** on the CI GPU runners, a deliberate GPU-subprocess SIGSEGV does not die cleanly — it lands in an **unkillable D-state process** (SlangPy's Crashpad handler and/or the GPU-driver fault path hold it). Consequences: (1) even a `subprocess.run(..., timeout=N)` in the parent CANNOT reap it — the timeout fires, SIGKILL is sent, but the faulted child never dies, so `subprocess.run` blocks forever and the whole "Unit Tests (Python)" step wedges until the 6h GitHub job timeout; (2) `spy.crashpad.is_supported()` did not reliably gate it (the skip either didn't fire or the wedge is independent of the parent test).

**Rule:** do NOT rely on runtime capability probes (crashpad detection, timeouts, subprocess isolation) to make a deliberately-crashing GPU test safe on CI. They are all insufficient — the crash is unkillable. Instead **hard-guard on the CI environment** so the crashing path NEVER runs on a runner:
`if os.environ.get("GITHUB_ACTIONS") or os.environ.get("CI"): pytest.skip(...)`.
Keep non-crashing controls (e.g. constant-start variants) always-on for the actual regression value; run the crashing tripwire on local/dev only.

**Meta-lesson (cost):** this burned ~3× 6-hour GPU CI runs. When a failure is NOT reproducible in your local build (here: local builds have crashpad OFF, `is_supported()==False`, so the hang never showed locally), do NOT iterate speculative fixes through CI — each cycle is 6h of shared GPU time. Either reproduce the exact CI config first, or apply the maximally-conservative guard (skip on CI entirely) in ONE shot. "Passes locally, hangs only in CI" for a crash test = guard on CI env immediately.

Diagnosis tell that it's YOUR test: `gh run list --workflow ci.yml` shows only your branch with multi-hour durations while every sibling PR completes in ~15min.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783931282447-correction-a-deliberately-crashing-gpu-test-wedges.md`_
